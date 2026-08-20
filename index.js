import * as yaml from 'https://lsong.org/scripts/text/yaml.js';
import {
  bindDialog,
  confirmDialog,
  showDialog,
} from 'https://lsong.org/scripts/dom/dialog.js?v2';

const ICON_COLORS = [
  '#fee2e2', '#ffedd5', '#fef9c3', '#dcfce7', '#dbeafe',
  '#ede9fe', '#fae8ff', '#cffafe', '#e0e7ff', '#d1fae5'
];

const STORAGE_KEY = 'lsong:start:bookmarks';
let publicFolders = [];
let localBookmarks = [];
let filteringReady = false;

const slugify = value => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const isImageIcon = icon => /^(https?:|data:image)/.test(icon || '');

const createIcon = (link, index) => {
  const fallback = document.createElement('span');
  fallback.className = 'link-icon';
  fallback.style.setProperty('--icon-bg', ICON_COLORS[index % ICON_COLORS.length]);
  fallback.textContent = link.icon && !isImageIcon(link.icon) ? link.icon : link.title.charAt(0);

  if (!isImageIcon(link.icon)) return fallback;

  const image = document.createElement('img');
  image.className = 'link-icon';
  image.src = link.icon;
  image.alt = '';
  image.decoding = 'async';
  image.referrerPolicy = 'no-referrer';
  image.hidden = true;
  image.addEventListener('load', () => {
    fallback.hidden = true;
    image.hidden = false;
  }, { once: true });
  image.addEventListener('error', () => image.remove(), { once: true });

  const wrapper = document.createElement('span');
  wrapper.append(fallback, image);
  return wrapper;
};

const saveLocalBookmarks = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localBookmarks));
    return true;
  } catch {
    return false;
  }
};

const loadLocalBookmarks = () => {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const removeLocalBookmark = async bookmark => {
  const confirmed = await confirmDialog(
    `Remove “${bookmark.title}” from your local bookmarks?`,
    {
      title: 'Remove bookmark?',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      confirmClass: 'button button-danger',
      cancelClass: 'button button-secondary',
    },
  );
  if (!confirmed) return;
  localBookmarks = localBookmarks.filter(item => item.id !== bookmark.id);
  if (saveLocalBookmarks()) renderDirectory();
};

const createBookmark = (link, index, folderName, isLocal = false) => {
  const item = document.createElement('li');
  item.className = `card bookmark-card${isLocal ? ' bookmark-card-local' : ''}`;
  item.dataset.search = [folderName, link.title, link.description].filter(Boolean).join(' ').toLowerCase();

  const anchor = document.createElement('a');
  anchor.className = 'bookmark-link';
  anchor.href = link.url;
  anchor.title = link.description || link.title;

  const content = document.createElement('span');
  content.className = 'link-content';

  const title = document.createElement('span');
  title.className = 'link-title';
  title.textContent = link.title;
  content.append(title);

  if (link.description) {
    const description = document.createElement('small');
    description.className = 'link-description';
    description.textContent = link.description;
    content.append(description);
  }

  anchor.append(createIcon(link, index), content);
  item.append(anchor);

  if (isLocal) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button button-ghost button-small bookmark-delete';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${link.title}`);
    remove.addEventListener('click', () => removeLocalBookmark(link));
    item.append(remove);
  }
  return item;
};

const createFolder = (folder, folderIndex) => {
  const section = document.createElement('section');
  section.className = 'bookmark-folder';
  section.dataset.folder = folder.name.toLowerCase();
  section.id = slugify(folder.name);

  const header = document.createElement('header');
  header.className = 'folder-header';
  const title = document.createElement('h3');
  title.textContent = folder.name;
  const count = document.createElement('span');
  count.textContent = `${folder.links?.length || 0} links`;
  header.append(title, count);

  const list = document.createElement('ul');
  list.className = 'bookmark-grid grid grid-cols-4 md-grid-cols-3 sm-grid-cols-2';
  folder.links?.forEach((link, index) => {
    list.append(createBookmark(link, folderIndex * 13 + index, folder.name, folder.local));
  });

  section.append(header, list);
  return section;
};

const fetchData = async () => {
  const response = await fetch('data.yaml', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Bookmarks request failed: ${response.status}`);
  return yaml.load(await response.text());
};

const filterBookmarks = () => {
  const input = document.querySelector('#search-input');
  const count = document.querySelector('#directory-count');
  const empty = document.querySelector('#empty-state');
  const total = document.querySelectorAll('.bookmark-card').length;
  const query = input.value.trim().toLowerCase();
  let visible = 0;

  document.querySelectorAll('.bookmark-folder').forEach(folder => {
    let folderVisible = 0;
    folder.querySelectorAll('.bookmark-card').forEach(card => {
      const match = !query || card.dataset.search.includes(query);
      card.hidden = !match;
      if (match) folderVisible += 1;
    });
    folder.hidden = folderVisible === 0;
    visible += folderVisible;
  });

  count.textContent = query ? `${visible} of ${total} links` : `${total} links`;
  empty.hidden = visible !== 0;
};

const setupFiltering = () => {
  if (filteringReady) return;
  filteringReady = true;
  const input = document.querySelector('#search-input');

  input.addEventListener('input', filterBookmarks);
  document.addEventListener('keydown', event => {
    if (event.key === '/' && document.activeElement !== input) {
      event.preventDefault();
      input.focus();
    }
    if (event.key === 'Escape' && document.activeElement === input) {
      input.value = '';
      filterBookmarks();
      input.blur();
    }
  });
};

const renderDirectory = () => {
  const app = document.querySelector('#app');
  const folders = [...publicFolders];
  if (localBookmarks.length) {
    folders.unshift({ name: 'My Bookmarks', links: localBookmarks, local: true });
  }

  const fragment = document.createDocumentFragment();
  folders.forEach((folder, index) => fragment.append(createFolder(folder, index)));
  app.replaceChildren(fragment);
  filterBookmarks();
};

const normalizeUrl = value => {
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  const url = new URL(candidate);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use an HTTP or HTTPS URL.');
  return url.href;
};

const setupBookmarkDialog = () => {
  const dialog = document.querySelector('#bookmark-dialog');
  const form = document.querySelector('#bookmark-form');
  const error = document.querySelector('#bookmark-form-error');
  bindDialog(dialog);

  document.querySelector('#add-bookmark').addEventListener('click', () => {
    form.reset();
    error.hidden = true;
    showDialog(dialog, { initialFocus: '[name="title"]' });
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    error.hidden = true;

    try {
      const data = new FormData(form);
      const bookmark = {
        id: globalThis.crypto?.randomUUID?.() || String(Date.now()),
        title: String(data.get('title')).trim(),
        url: normalizeUrl(String(data.get('url'))),
        description: String(data.get('description')).trim(),
        icon: String(data.get('icon')).trim(),
      };

      if (!bookmark.title) throw new Error('Enter a bookmark name.');
      localBookmarks.unshift(bookmark);
      if (!saveLocalBookmarks()) {
        localBookmarks.shift();
        throw new Error('This browser could not save the bookmark locally.');
      }

      renderDirectory();
      dialog.close('added');
    } catch (cause) {
      error.textContent = cause.message || 'The bookmark could not be added.';
      error.hidden = false;
    }
  });
};

const render = async () => {
  const app = document.querySelector('#app');
  const loading = document.querySelector('#loading');
  const count = document.querySelector('#directory-count');

  try {
    publicFolders = await fetchData();
    localBookmarks = loadLocalBookmarks();
    setupFiltering();
    setupBookmarkDialog();
    renderDirectory();
  } catch (error) {
    count.textContent = 'Unable to load links';
    const message = document.createElement('p');
    message.className = 'alert alert-danger';
    message.textContent = 'The directory could not be loaded. Please try again.';
    app.replaceChildren(message);
  } finally {
    loading.hidden = true;
    app.setAttribute('aria-busy', 'false');
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', render, { once: true });
} else {
  render();
}
