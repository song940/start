import { ready } from 'https://lsong.org/scripts/dom/index.js';
import { query, encode } from 'https://lsong.org/scripts/navigation/query.js';
import { parse as parseMarkdown } from 'https://lsong.org/scripts/text/markdown.js';
import { h, render, useState, useEffect } from 'https://lsong.org/scripts/react/index.js';
import { OpenAI } from 'https://lsong.org/chatgpt-demo/openai.js';

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

const mockSearch = q => ({
  search_parameters: { q },
  organic_results: [
    {
      position: 1,
      title: `${q} — MDN Web Docs`,
      link: `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(q)}`,
      displayed_link: 'developer.mozilla.org',
      source: 'MDN Web Docs',
      snippet: `Practical reference material and examples for ${q}, including browser APIs, syntax, and recommended usage.`,
    },
    {
      position: 2,
      title: `${q} on GitHub`,
      link: `https://github.com/search?q=${encodeURIComponent(q)}&type=repositories`,
      displayed_link: 'github.com',
      source: 'GitHub',
      snippet: `Explore open-source repositories, discussions, and implementation patterns related to ${q}.`,
    },
    {
      position: 3,
      title: `Learn ${q} — web.dev`,
      link: `https://web.dev/learn/${encodeURIComponent(q)}`,
      displayed_link: 'web.dev',
      source: 'web.dev',
      snippet: `A guided collection of lessons and best practices for building reliable experiences with ${q}.`,
    },
    {
      position: 4,
      title: `${q} documentation and guides`,
      link: `https://www.google.com/search?q=${encodeURIComponent(`${q} documentation`)}`,
      displayed_link: 'google.com',
      source: 'Search preview',
      snippet: `A representative result used to preview the search result card layout locally.`,
    },
  ],
  top_stories: [
    { title: `What’s new in ${q}`, link: `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(q)}`, source: 'MDN Web Docs', date: 'Today' },
    { title: `${q} community highlights`, link: `https://github.com/search?q=${encodeURIComponent(q)}&type=discussions`, source: 'GitHub', date: 'This week' },
  ],
  related_questions: [
    { question: `What is ${q}?`, snippet: `${q} is a topic with a broad set of concepts, tools, and practical applications.`, title: 'Reference guide', link: `https://www.google.com/search?q=${encodeURIComponent(`what is ${q}`)}`, displayed_link: 'google.com' },
    { question: `How do I get started with ${q}?` },
  ],
  related_searches: [
    { query: `${q} tutorial` },
    { query: `${q} examples` },
    { query: `${q} best practices` },
    { query: `${q} tools` },
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
  const generateSummary = async () => {
    const fulltext = result.organic_results?.reduce((fulltext, item, index) => {
      const text = [item.title, item.snippet, `id: #result-${index}`, item.link].join('\n');
      return `${fulltext}\n\n[${item.position}]. ${text}`;
    }, '');
    const questions = result.related_questions?.reduce((out, q, index) => {
      return [
        out,
        `id: #Q${index + 1}`,
        `Q: ${q.question}`,
        `A: ${q.snippet}`,
        `source: [${q.title}](${q.link})`
      ].join('\n');
    }, 'Related Questions:\n');
    try {
      setDone(false);
      setError('');
      setSummary('');
      const prompt = `Query: ${result.search_parameters.q}\nSearch Result: ${fulltext}\n\n${questions}`;
      const userMessage = { role: 'user', content: prompt };
      const systemMessage = {
        role: 'system',
        content: `
          As a search assistant, your task is to help the user understand the search results by providing a detailed summary.
          Highlight the key points, relevant facts, and important information found in the search results.
          When citing links, please use the format <sup>[[1](#result-0)]</sup>.
          Additionally, offer insights and context where necessary to enhance the user's comprehension.
          Please use ${lang || 'same language as the query'} and markdown in your response.`
      };
      const response = await openai.createChatCompletion({
        model,
        messages: [systemMessage, userMessage],
        stream: true,
      });
      for await (const chunk of response) {
        if (chunk.error && chunk.error.code != 0) {
          throw new Error(chunk.error.message);
        }
        const content = chunk.choices[0]?.delta?.content || '';
        setSummary(summary => summary + content);
      }
    } catch {
      setError('AI overview is temporarily unavailable. The search results below are still available.');
    } finally {
      setDone(true);
    }
  };
  useEffect(() => {
    generateSummary();
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
