import { ready } from 'https://lsong.org/scripts/dom/index.js';
import { query, encode } from 'https://lsong.org/scripts/navigation/query.js';
import { parse as parseMarkdown } from 'https://lsong.org/scripts/text/markdown.js';
import { h, render, useState, useEffect } from 'https://lsong.org/scripts/react/index.js';
import { OpenAI } from 'https://lsong.org/chatgpt-demo/openai.js?v5';

const {
  lang,
  model = 'free',
} = query;

const openai = new OpenAI({
  api: "https://models.lsong.org/v1",
  apiKey: "sk-lsong_startpage",
});

// const response = await openai.createChatCompletion({
//   model,
//   messages: [{ role: 'user', content: 'Hello!' }],
//   stream: true,
// });
// for await (const part of response) {
//   const content = part.choices[0]?.delta?.content || '';
//   console.log(content);
// }

const searchEngines = [
  { name: 'Google', host: 'google.com', url: q => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
  { name: 'Bing', host: 'bing.com', url: q => `https://www.bing.com/search?q=${encodeURIComponent(q)}` },
  { name: 'DuckDuckGo', host: 'duckduckgo.com', url: q => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
  { name: 'Baidu', host: 'baidu.com', url: q => `https://www.baidu.com/s?wd=${encodeURIComponent(q)}` },
  { name: 'Yahoo', host: 'yahoo.com', url: q => `https://search.yahoo.com/search?p=${encodeURIComponent(q)}` },
];

const mockSearch = q => ({
  search_parameters: { q },
  organic_results: searchEngines.map((engine, index) => ({
    position: index + 1,
    title: `Search ${q} on ${engine.name}`,
    link: engine.url(q),
    displayed_link: engine.host,
    source: engine.name,
    snippet: `Search for "${q}" using ${engine.name}.`,
  })),
  top_stories: [
    { title: `Search ${q} on Google`, link: `https://www.google.com/search?q=${encodeURIComponent(q)}`, source: 'Google', date: 'Today' },
    { title: `Search ${q} on Bing`, link: `https://www.bing.com/search?q=${encodeURIComponent(q)}`, source: 'Bing', date: 'This week' },
  ],
  related_questions: [
    {
      question: `What is ${q}?`,
      snippet: `${q} is a topic with a broad set of concepts, tools, and practical applications.`,
      title: 'Search on Google',
      link: `https://www.google.com/search?q=${encodeURIComponent(`what is ${q}`)}`,
      displayed_link: 'google.com',
    },
    {
      question: `How to use ${q}?`,
      snippet: `Find step-by-step guides, common patterns, and recommended ways to work with ${q}.`,
      title: 'Search on Bing',
      link: `https://www.bing.com/search?q=${encodeURIComponent(`how to use ${q}`)}`,
      displayed_link: 'bing.com',
    },
    {
      question: `Where to find ${q} documentation?`,
      snippet: `Browse official docs, API references, and release notes for ${q}.`,
      title: 'Search on DuckDuckGo',
      link: `https://duckduckgo.com/?q=${encodeURIComponent(`${q} documentation`)}`,
      displayed_link: 'duckduckgo.com',
    },
    {
      question: `What are some ${q} examples?`,
      snippet: `Discover real-world code samples and starter projects using ${q}.`,
      title: 'Search on Baidu',
      link: `https://www.baidu.com/s?wd=${encodeURIComponent(`${q} examples`)}`,
      displayed_link: 'baidu.com',
    },
  ],
  related_searches: [
    { query: `${q} tutorial` },
    { query: `${q} documentation` },
    { query: `${q} github` },
    { query: `${q} examples` },
    { query: `${q} best practices` },
  ],
});

const search = async q => {
  if (!q) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(`https://api.lsong.org/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`Search request failed (${response.status})`);
    return await response.json();
  } catch {
    // Keep the local page useful when the remote API is unavailable or blocked by CORS.
    return mockSearch(q);
  } finally {
    clearTimeout(timeout);
  }
};

const Overview = ({ result }) => {
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let aborted = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const generateSummary = async () => {
      const fulltext = result.organic_results?.reduce((acc, item, index) => {
        const text = [item.title, item.snippet, `id: #result-${index}`, item.link].join('\n');
        return `${acc}\n\n[${item.position}]. ${text}`;
      }, '');
      const questions = result.related_questions?.reduce((acc, q, index) => {
        if (!q?.question) return acc;
        return [
          acc,
          `id: #Q${index + 1}`,
          `Q: ${q.question}`,
          `A: ${q.snippet || ''}`,
          `source: [${q.title || ''}](${q.link || ''})`
        ].join('\n');
      }, 'Related Questions:\n');

      try {
        setDone(false);
        setError('');
        setSummary('');
        const prompt = `Query: ${result.search_parameters?.q}\nSearch Result: ${fulltext}\n\n${questions}`;
        const userMessage = { role: 'user', content: prompt };
        const systemMessage = {
          role: 'system',
          content: `As a search assistant, your task is to help the user understand the search results by providing a detailed summary. Highlight the key points, relevant facts, and important information found in the search results. When citing links, please use the format <sup>[[1](#result-0)]</sup>. Additionally, offer insights and context where necessary to enhance the user's comprehension. Please use ${lang || 'same language as the query'} and markdown in your response.`
        };
        const response = await openai.createChatCompletion({
          model,
          messages: [systemMessage, userMessage],
          stream: true,
          signal: controller.signal,
        });
        for await (const chunk of response) {
          if (aborted) break;
          if (chunk.error && chunk.error.code !== 0) {
            throw new Error(chunk.error.message);
          }
          const content = chunk.choices?.[0]?.delta?.content || '';
          setSummary(prev => prev + content);
        }
      } catch (err) {
        if (aborted || err.name === 'AbortError') return;
        setError('AI overview is temporarily unavailable. The search results below are still available.');
      } finally {
        if (!aborted) setDone(true);
        clearTimeout(timeout);
      }
    };

    generateSummary();

    return () => {
      aborted = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [result]);
  return h('section', { className: 'search-section overview-section', 'aria-labelledby': 'overview-title' }, [
    h('h2', { id: 'overview-title' }, "Overview"),
    error
      ? h('p', { className: 'overview overview-error', role: 'status' }, error)
      : h('div', { className: 'overview', dangerouslySetInnerHTML: { __html: parseMarkdown(summary) } }),
    done && summary && h('form', { action: "https://lsong.org/chatgpt-demo", className: 'input-group width-full' }, [
      h('input', { name: "assistant", type: "hidden", value: summary }),
      h('input', { name: "user", className: "input input-block input-small", placeholder: "Continue with ChatGPT 🤖" }),
      h('button', { type: "submit", className: "button button-small" }, "Send"),
    ]),
  ]);
};

const SearchForm = ({ onSearch }) => {
  const [q, setKeyword] = useState('');
  const handleSearch = e => {
    e.preventDefault();
    onSearch(q);
  };
  useEffect(() => {
    query.q && setKeyword(query.q);
    query.q && onSearch(query.q);
  }, []);
  return h('section', { className: 'search-query', 'aria-labelledby': 'search-title' }, [
    h('h2', { id: 'search-title' }, 'Search'),
    h('form', { action: 'search.html', method: 'get', role: 'search', className: 'input-group width-full full-width', onSubmit: handleSearch }, [
      h('input', {
        value: q,
        name: 'q',
        type: 'search',
        autofocus: true,
        className: 'input input-block',
        placeholder: 'Type keyword to search',
        onChange: e => setKeyword(e.target.value),
      }),
      h('button', { type: 'submit', className: 'button button-primary' }, 'Search'),
    ])
  ]);
};

const ResultList = ({ result }) => {
  return h('section', { className: 'search-section results-section', 'aria-labelledby': 'results-title' }, [
    h('h2', { id: 'results-title' }, "Results"),
    h('ol', { className: 'search-results' }, result.organic_results?.map((item, index) =>
      h('li', { key: item.position || index, id: `result-${index}`, className: 'card' },
        h('article', { className: 'search-result' }, [
          h('div', { className: 'result-source' }, [
            item.favicon && h('img', { src: item.favicon, alt: '', width: 16, height: 16, loading: 'lazy' }),
            h('span', {}, item.source || item.displayed_link),
          ]),
          h('h3', null, h('a', { href: item.link }, item.title)),
          item.displayed_link && h('p', { className: 'result-url' }, item.displayed_link),
          item.snippet && h('p', { className: 'result-snippet' }, item.snippet),
          item.date && h('time', null, item.date),
        ])
      )
    ))
  ]);
}

const RelatedSearches = ({ relatedSearches }) => {
  return h('section', { className: 'search-section related-searches-section', 'aria-labelledby': 'related-searches-title' }, [
    h('h2', { id: 'related-searches-title' }, 'Related Searches'),
    h('ul', { className: 'related-searches' }, relatedSearches?.map((item, index) =>
      h('li', { key: index, className: 'card' },
        h('a', { href: `?q=${item.query}` }, item.query)
      )
    ))
  ]);
};

const RelatedQuestions = ({ relatedQuestions }) => {
  return h('section', { className: 'search-section related-questions-section', 'aria-labelledby': 'related-questions-title' }, [
    h('h2', { id: 'related-questions-title' }, 'Related Questions'),
    h('ul', { className: 'related-questions' }, relatedQuestions?.map((item, index) =>
      h('li', { key: index, className: 'card', id: `Q${index + 1}` },
        h('article', null, [
          h('h3', { className: 'question' }, item.snippet
            ? item.question
            : h('a', { href: `?q=${encodeURIComponent(item.question)}` }, item.question)),
          item.snippet && h('p', { className: 'answer' }, item.snippet),
          item.link && h('footer', { className: 'question-source' }, [
            item.source_logo && h('img', { src: item.source_logo, alt: '', width: 16, height: 16, loading: 'lazy' }),
            item.displayed_link && h('span', {}, item.displayed_link),
            h('a', { href: item.link }, item.title || item.displayed_link),
          ]),
        ])
      )
    ))
  ]);
};

const TopStories = ({ topStories }) => {
  return h('section', { className: 'search-section top-stories-section', 'aria-labelledby': 'top-stories-title' }, [
    h('h2', { id: 'top-stories-title' }, 'Top Stories'),
    h('ul', { className: 'top-stories' }, topStories.map((item, index) =>
      h('li', { key: index, className: 'card' },
        h('article', null, [
          item.thumbnail && h('img', { src: item.thumbnail, alt: '', loading: 'lazy' }),
          h('div', null, [
            h('h3', null, h('a', { href: item.link }, item.title)),
            h('p', { className: 'story-meta' }, [
              item.source && h('span', null, item.source),
              item.date && h('time', null, item.date),
            ]),
          ])
        ])
      )
    ))
  ]);
};

const App = () => {
  const [result, setResult] = useState({});
  const handleSearch = async q => {
    const loading = document.getElementById('loading');
    setResult({});
    loading.hidden = false;
    history.replaceState(null, null, '?' + encode({ ...query, q }));
    const data = await search(q);
    setResult(data);
    loading.hidden = true;
  };
  return [
    h(SearchForm, { onSearch: handleSearch }),
    result.organic_results && h(Overview, { result }),
    result.organic_results && h(ResultList, { result }),
    result.top_stories && h(TopStories, { topStories: result.top_stories }),
    result.related_questions && h(RelatedQuestions, { relatedQuestions: result.related_questions }),
    result.related_searches && h(RelatedSearches, { relatedSearches: result.related_searches.filter(x => x.query) }),
  ];
};

ready(() => {
  const app = document.getElementById('app');
  render(h(App), app);
});
