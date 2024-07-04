import { ready } from 'https://lsong.org/scripts/dom.js';
import * as yaml from 'https://lsong.org/scripts/yaml.js';
import { h, render, useState, useEffect } from 'https://lsong.org/scripts/react/index.js';

const renderLink = (link, index) => {
  const colors = [
    'rgb(249, 195, 141)',
    'rgb(173, 255, 173)',
    'rgb(255, 255, 203)',
    'rgb(166, 197, 255)',
    'rgb(244, 197, 242)',
    'rgb(255, 174, 178)',
  ];
  const handleError = e => {
    e.target.style.display = 'none';
    e.target.nextSibling.style.display = 'flex';
  };
  const handleLoad = e => {
    e.target.style.display = 'block';
    e.target.nextSibling.style.display = 'none';
  };

  return h('a', { className: 'link', href: link.url }, [
    (link.icon && /^(http|data)/.test(link.icon)) && h('img', {
      className: 'link-icon',
      src: link.icon,
      onLoad: handleLoad,
      onError: handleError,
      style: { display: 'none' },
    }),
    h('span', {
      className: 'link-icon',
      style: {
        display: 'flex',
        backgroundColor: colors[index % colors.length],
      },
    },
      (!link.icon || /^(http|data)/.test(link.icon)) ? link.title[0] : link.icon),
    link.title,
  ]);
};

const renderFolder = folder => {
  return h('div', null,
    h('h3', null, folder.name),
    h('ul', { className: 'list' },
      folder.links && folder.links.map((bookmark, index) =>
        h('li', null, renderLink(bookmark, index))
      )
    )
  );
}

const fetchData = async () => {
  const response = await fetch('data.yaml');
  const text = await response.text();
  return yaml.load(text);
};

const App = () => {
  const [bookmarks, setBookmarks] = useState([]);

  useEffect(() => {
    fetchData().then(x => setBookmarks(x));
  }, []);

  return h('div', { className: 'bookmarks' },
    h('h2', null, "Bookmarks"),
    bookmarks.map((bookmark, index) => renderFolder(bookmark))
  );
};

ready(() => {
  const app = document.getElementById('app');
  const loading = document.getElementById('loading');
  render(h(App), app);
  loading.hidden = true;
});