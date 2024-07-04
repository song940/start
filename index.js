import { ready } from 'https://lsong.org/scripts/dom.js';
import * as yaml from 'https://lsong.org/scripts/yaml.js';
import { h, render, useState, useEffect } from 'https://lsong.org/scripts/react/index.js';

const COLORS = [
  'rgb(255, 179, 186)', // 浅粉红
  'rgb(255, 223, 186)', // 浅橙色
  'rgb(255, 255, 186)', // 浅黄色
  'rgb(186, 255, 201)', // 浅绿色
  'rgb(186, 225, 255)', // 浅蓝色
  'rgb(223, 186, 255)', // 浅紫色
  'rgb(255, 179, 255)', // 亮粉红
  'rgb(179, 255, 255)', // 浅青色
  'rgb(191, 207, 255)', // 淡蓝色
  'rgb(204, 255, 204)', // 浅薄荷绿
  'rgb(255, 230, 204)', // 浅杏色
  'rgb(230, 230, 250)', // 薰衣草色
  'rgb(255, 240, 245)', // 浅粉红褐色
  'rgb(240, 248, 255)', // 爱丽丝蓝
  'rgb(255, 250, 205)', // 柠檬绸色
  'rgb(255, 228, 225)', // 薄雾玫瑰
  'rgb(240, 255, 240)', // 蜜瓜色
  'rgb(255, 255, 224)', // 浅黄色
  'rgb(255, 218, 185)'  // 桃色
];

const LinkIcon = ({ link, index }) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleLoad = () => setImageLoaded(true);
  const handleError = () => setImageLoaded(false);
  const isRes = /^(http|data)/.test(link.icon);

  const getFallbackIcon = () => {
    if (link.icon && !isRes)
      return link.icon;
    return link.title[0];
  };

  const fallbackIcon = h('span', {
    className: 'link-icon',
    style: {
      display: imageLoaded ? 'none' : 'flex',
      backgroundColor: COLORS[index % COLORS.length],
    }
  }, getFallbackIcon());

  const imageIcon = link.icon && isRes && h('img', {
    className: 'link-icon',
    src: link.icon,
    onLoad: handleLoad,
    onError: handleError,
    style: { display: imageLoaded ? 'block' : 'none' }
  });
  return [fallbackIcon, imageIcon];
};

const Link = ({ link, index }) =>
  h('a', { className: '', href: link.url }, [
    h(LinkIcon, { link, index }),
    link.title
  ]);

const Folder = ({ folder }) =>
  h('div', null, [
    h('h3', null, folder.name),
    h('ul', { className: 'grid' },
      folder.links?.map((bookmark, index) =>
        h('li', { key: index, className: 'col-3 col-lg-4 col-sm-6 link' }, h(Link, { link: bookmark, index }))
      )
    )
  ]);

const fetchData = async () => {
  const response = await fetch('data.yaml');
  const text = await response.text();
  return yaml.load(text);
};

const App = () => {
  const [bookmarks, setBookmarks] = useState([]);

  useEffect(() => {
    fetchData().then(setBookmarks);
  }, []);

  return h('div', { className: 'bookmarks' }, [
    h('h2', null, 'Bookmarks'),
    ...bookmarks.map((bookmark, index) =>
      h(Folder, { key: index, folder: bookmark })
    )
  ]);
};

ready(() => {
  const app = document.getElementById('app');
  const loading = document.getElementById('loading');
  render(h(App), app);
  loading.hidden = true;
});