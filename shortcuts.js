import { ready } from 'https://lsong.org/scripts/dom.js';
import * as yaml from 'https://lsong.org/scripts/yaml.js';

ready(async () => {
  const app = document.getElementById('app');
  const response = await fetch('shortcuts.yaml');
  const text = await response.text();
  const { shortcuts } = yaml.load(text);
  const name = location.pathname.slice(1);
  const link = shortcuts[name];
  if (!link) {
    app.innerHTML = `
      <h2>Not Found</h2>
      <p>The page you requested could not be found.</p>
      <p>We will be redirect you to <a href="https://go.lsong.org">start page</a> in 3 seconds.</p>
      <p>or return <a href="https://lsong.org">home</a>.</p>
    `;
    setTimeout(() => location.href = "/", 3000);
    return;
  }
  app.innerHTML = `
    <h2>Redirect</h1>
    <p>Redirecting to <a href="${link}" >${link}</a> ...</p>
  `;
  location.href = link;
});