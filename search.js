import { ready } from 'https://lsong.org/scripts/dom.js';
import { query, encode } from 'https://lsong.org/scripts/query.js';
import { parse as parseMarkdown } from 'https://lsong.org/scripts/marked.js';
import { h, render, useState, useEffect } from 'https://lsong.org/scripts/react/index.js';
import { OpenAI } from 'https://lsong.org/chatgpt-demo/openai.js';

const {
  lang,
  // gpt-4, gpt-3.5-turbo, qwen2
  model = 'gpt-3.5-turbo'
} = query;

const openai = new OpenAI({
  api: "https://oai.lsong.org/v1",
  apiKey: 'c97f2b499aeb46eb' + 'be29aef5a2052906',
});

const search = async q => {
  const response = await fetch(`https://api.lsong.org/search?q=${q}`);
  return response.json();
};

const Overview = ({ result }) => {
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState('');
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
    console.log(prompt);
    const response = await openai.createChatCompletion({
      model,
      messages: [systemMessage, userMessage],
      stream: true,
    });
    for await (const part of response) {
      const content = part.choices[0]?.delta?.content || '';
      setSummary(summary => summary + content);
    }
    setDone(true);
  };
  useEffect(() => {
    generateSummary();
  }, [result]);
  return [
    h('h2', null, "Overview"),
    h('p', { className: 'overview', dangerouslySetInnerHTML: { __html: parseMarkdown(summary) } }),
    done && h('form', { action: "https://lsong.org/chatgpt-demo", className: 'input-group width-full' }, [
      h('input', { name: "assistant", type: "hidden", value: summary }),
      h('input', { name: "user", className: "input input-block input-small", placeholder: "Continue with ChatGPT 🤖" }),
      h('button', { type: "submit", className: "button button-small" }, "Send"),
    ]),
  ];
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
  return [
    h('h2', {}, 'Search'),
    h('form', { className: 'input-group width-full full-width', onSubmit: handleSearch }, [
      h('input', {
        value: q,
        name: 'q',
        type: 'search',
        autofocus: true,
        className: 'input input-block',
        action: 'search.html',
        placeholder: 'Type keyword to search',
        onChange: e => setKeyword(e.target.value),
      }),
      h('button', { type: 'submit', className: 'button button-primary' }, 'Search'),
    ])
  ];
};

const ResultList = ({ result }) => {
  return [
    h('h2', null, "Results"),
    h('ul', { className: 'search-results grid' }, result.organic_results?.map((item, index) =>
      h('li', { key: index, id: `result-${index}`, className: 'col-12' }, [
        item.favicon && h('img', { src: item.favicon, width: 16, height: 16 }),
        h('span', {}, item.displayed_link),
        h('a', { href: item.link }, item.title),
        h('p', null, item.snippet),
      ])
    ))
  ];
}

const RelatedSearches = ({ relatedSearches }) => {
  return [
    h('h2', null, 'Related Searches'),
    h('ul', { className: 'related-searches grid' }, relatedSearches?.map((item, index) =>
      h('li', { key: index, className: 'col-4 col-sm-6' },
        h('a', { href: `?q=${item.query}` }, item.query)
      )
    ))
  ];
};

const RelatedQuestions = ({ relatedQuestions }) => {
  return [
    h('h2', null, 'Related Questions'),
    h('ul', { className: 'related-questions grid' }, relatedQuestions?.map((item, index) =>
      h('li', { key: index, className: 'col-12', id: `Q${index + 1}` },
        h('a', { className: 'question' }, item.question),
        h('p', { className: 'answer' }, item.snippet),
        h('div', null, [
          item.source_logo && h('img', { src: item.source_logo, width: 16, height: 16 }),
          h('span', {}, item.displayed_link),
          h('a', { href: item.link, className: 'block' }, item.title),
        ]),
      )
    ))
  ];
};

const TopStories = ({ topStories }) => {
  return [
    h('h2', null, 'Top Stories'),
    h('ul', { className: 'top-stories grid' }, topStories.map((item, index) =>
      h('li', { key: index, className: 'flex flex-row col-12' }, [
        h('img', { style: `background-image: url(${item.thumbnail});` }),
        h('div', null, [
          h('a', { href: item.link, className: 'block' }, item.title),
          h('span', { className: 'block' }, item.source),
          h('time', null, item.date),
        ])
      ])
    ))
  ]
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
    result.related_searches && h(RelatedSearches, { relatedSearches: result.related_searches }),
  ];
};

ready(() => {
  const app = document.getElementById('app');
  render(h(App), app);
});