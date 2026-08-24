import { ready } from 'https://lsong.org/scripts/dom/index.js';
import * as yaml from 'https://lsong.org/scripts/text/yaml.js';

ready(async () => {
  const app = document.getElementById('app');
  const response = await fetch('shortcuts.yaml');
  if (!response.ok) throw new Error(`Shortcuts request failed: ${response.status}`);

  const text = await response.text();
  const { shortcuts } = yaml.load(text);
  const name = location.pathname.slice(1);
  const link = shortcuts[name];
  if (!link) {
    app.innerHTML = `
      <h2 id="error-title">Page not found.</h2>
      <p>The page you requested could not be found.</p>
      <p>You will return to <a href="/">Start</a> in 3 seconds, or you can go to <a href="https://lsong.org">Home</a>.</p>
    `;
    setTimeout(() => location.href = "/", 3000);
    return;
  }
  app.innerHTML = `
    <h2 id="error-title">Redirecting.</h2>
    <p>Taking you to <a href="${link}">${link}</a>…</p>
  `;
  location.href = link;
});
