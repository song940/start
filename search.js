import { ready } from 'https://lsong.org/scripts/dom.js';
import { query, encode } from 'https://lsong.org/scripts/query.js';
import { parse as parseMarkdown } from 'https://lsong.org/scripts/marked.js';
import { h, render, useState, useEffect } from 'https://lsong.org/scripts/react/index.js';
import { Ollama } from 'https://lsong.org/ollama-demo/ollama.js';
import { OpenAI } from 'https://lsong.org/chatgpt-demo/openai.js';

const {
  lang,
  // gpt-4, gpt-3.5-turbo, qwen2
  model = 'gpt-3.5-turbo'
} = query;

const ollama = new Ollama({
  host: 'https://ollama.lsong.org',
});

const openai = new OpenAI({
  api: "https://oai.lsong.org/v1",
  apiKey: 'c97f2b499aeb46eb' + 'be29aef5a2052906',
});

const search = async q => {
  const response = await fetch(`https://api.lsong.org/search?q=${q}`);
  return response.json();
};

const Overview = ({ result }) => {
  const [summary, setSummary] = useState('');
  const generateSummary = async () => {
    const fulltext = result.organic_results?.reduce((fulltext, item, index) => {
      const text = [item.title, item.snippet, `id: #result-${index}`, item.link].join('\n');
      return `${fulltext}\n\n[${item.position}]. ${text}`;
    }, '');
    setSummary('');
    const prompt = `Query: ${result.search_parameters.q}\nSearch Result: ${fulltext}`;
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
    switch (model) {
      case 'qwen2': {
        const response = ollama.chat({
          model: "qwen2",
          messages: [systemMessage, userMessage],
        });
        for await (const part of response) {
          const { role, content } = part.message;
          setSummary(summary => summary + content);
        }
        break;
      }
      case 'gpt-4':
      case 'gpt-3.5-turbo': {
        const response = await openai.createChatCompletion({
          model,
          messages: [systemMessage, userMessage],
          stream: true,
        });
        for await (const part of response) {
          const content = part.choices[0]?.delta?.content || '';
          setSummary(summary => summary + content);
        }
        break;
      }
      default:
        setSummary(`**unknown model: ${model}**`);
        console.error('unknown model', model);
        break;
    }
  };
  useEffect(() => {
    generateSummary();
  }, [result]);
  return [
    h('h2', null, "Overview"),
    h('p', { className: 'overview', dangerouslySetInnerHTML: { __html: parseMarkdown(summary) } }),
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
    h('form', { className: 'flex', onSubmit: handleSearch }, [
      h('input', {
        value: q,
        name: 'q',
        type: 'search',
        autofocus: true,
        className: 'input',
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
    h('ul', { className: 'search-results list' }, result.organic_results?.map((item, index) =>
      h('li', { key: index, id: `result-${index}` }, [
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
    h('ul', { className: 'related-searches list' }, relatedSearches?.map((item, index) =>
      h('li', { key: index },
        h('a', { href: `?q=${item.query}` }, item.query)
      )
    ))
  ];
};

const RelatedQuestions = ({ relatedQuestions }) => {
  return [
    h('h2', null, 'Related Questions'),
    h('ul', { className: 'related-questions list' }, relatedQuestions?.map((item, index) =>
      h('li', { key: index, className: '' },
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
    h('ul', { className: 'top-stories list' }, topStories.map((item, index) =>
      h('li', { key: index, className: 'flex flex-row' }, [
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