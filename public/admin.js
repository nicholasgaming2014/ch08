// Admin panel: edit home and contact, upload and manage beats.
const HEADERS = { 'X-Requested-With': 'ch08-admin' };
let content = null;

// ---------- Tabs ----------

const TABS = ['home', 'beats', 'art', 'clips', 'wikipedia', 'fc', 'contact'];
const tabLinks = document.querySelectorAll('.admin-tabs .menu-link');

function showTab() {
  let id = location.hash.slice(1);
  if (id === 'election' || id === 'census') id = 'wikipedia';
  if (!TABS.includes(id)) id = 'home';
  TABS.forEach(tab => document.getElementById('panel-' + tab).hidden = tab !== id);
  tabLinks.forEach(l => l.classList.toggle('active', l.hash === '#' + id));
}

window.addEventListener('hashchange', showTab);
showTab();

// Subtab switching within wikipedia panel
document.querySelectorAll('.admin-subtabs .subtab').forEach(tab => {
  tab.addEventListener('click', e => {
    e.preventDefault();
    const target = tab.dataset.subtab;
    document.querySelectorAll('.admin-subtabs .subtab').forEach(t => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.subtab-panel').forEach(p => p.hidden = p.id !== 'subtab-' + target);
  });
});

// ---------- Helpers ----------

function setStatus(form, message, isError = false) {
  const status = form.querySelector('.status');
  status.textContent = message;
  status.classList.toggle('error', isError);
}

// Sends a request with an optional upload progress callback.
function send(method, url, body, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    Object.entries(HEADERS).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    if (body && !(body instanceof FormData)) {
      xhr.setRequestHeader('Content-Type', 'application/json');
      body = JSON.stringify(body);
    }
    if (onProgress) xhr.upload.onprogress = e => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status === 401) {
        location.href = '/admin/login';
        return reject(new Error(data.error || 'Logged out.'));
      }
      if (xhr.status >= 400) return reject(new Error(data.error || `Something went wrong (${xhr.status}).`));
      resolve(data);
    };
    xhr.onerror = () => reject(new Error('Couldn’t reach the server. Check your connection.'));
    xhr.send(body);
  });
}

function setBusy(form, busy) {
  form.querySelectorAll('button').forEach(b => b.disabled = busy);
}

// ---------- Link editor ----------

function addLinkRow(editor, link = { label: '', url: '' }) {
  const row = document.createElement('div');
  row.className = 'link-row';

  const label = document.createElement('input');
  label.type = 'text';
  label.placeholder = 'label (e.g. instagram)';
  label.maxLength = 80;
  label.value = link.label;

  const url = document.createElement('input');
  url.type = 'text';
  url.placeholder = 'https://…';
  url.maxLength = 500;
  url.value = link.url;

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'button secondary';
  remove.textContent = '✕';
  remove.setAttribute('aria-label', 'Remove link');
  remove.addEventListener('click', () => row.remove());

  row.append(label, url, remove);
  editor.append(row);
}

function fillLinks(editor, links) {
  editor.replaceChildren();
  links.forEach(link => addLinkRow(editor, link));
}

function readLinks(editor) {
  return [...editor.querySelectorAll('.link-row')]
    .map(row => {
      const [label, url] = row.querySelectorAll('input');
      return { label: label.value.trim(), url: url.value.trim() };
    })
    .filter(link => link.label || link.url);
}

// ---------- Song editor (songs linked to a beat) ----------

function addSongRow(editor, song = { title: '', artist: '', url: '' }) {
  const row = document.createElement('div');
  row.className = 'link-row song-row';

  // Cover: an uploaded one (song.cover) wins over artwork fetched from the link.
  let manualCover = song.cover || '';
  let newFile = null;

  const thumb = document.createElement('button');
  thumb.type = 'button';
  thumb.className = 'song-thumb';
  thumb.title = 'Upload a cover (otherwise it’s pulled from the link)';
  thumb.setAttribute('aria-label', 'Upload song cover');
  const thumbImg = document.createElement('img');
  thumbImg.alt = '';
  thumb.append(thumbImg);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/jpeg,image/png,image/gif,image/webp';
  fileInput.hidden = true;

  const auto = document.createElement('button');
  auto.type = 'button';
  auto.className = 'button secondary song-auto';
  auto.textContent = 'auto';
  auto.title = 'Use the cover from the link instead';

  function showCover() {
    const src = newFile ? URL.createObjectURL(newFile) : manualCover || song.artwork || '';
    thumbImg.hidden = !src;
    if (src) thumbImg.src = src;
    thumb.classList.toggle('empty', !src);
    auto.hidden = !newFile && !manualCover;
  }

  thumb.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) newFile = fileInput.files[0];
    showCover();
  });
  auto.addEventListener('click', () => {
    newFile = null;
    manualCover = '';
    fileInput.value = '';
    showCover();
  });

  row.songCover = () => ({ cover: manualCover, file: newFile });
  showCover();

  const fields = [
    ['title', 'song title', 120],
    ['artist', 'original artist', 120],
    ['url', 'spotify / soundcloud link', 500],
  ].map(([key, placeholder, max]) => {
    const input = document.createElement('input');
    input.type = 'text';
    input.dataset.key = key;
    input.placeholder = placeholder;
    input.maxLength = max;
    input.value = song[key] || '';
    return input;
  });

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'button secondary';
  remove.textContent = '✕';
  remove.setAttribute('aria-label', 'Remove song');
  remove.addEventListener('click', () => row.remove());

  row.append(thumb, fileInput, ...fields, auto, remove);
  editor.append(row);
}

// Adds the songs (and any newly picked covers) to the form data being sent.
function appendSongs(data, editor) {
  const songs = [];
  editor.querySelectorAll('.song-row').forEach(row => {
    const song = Object.fromEntries([...row.querySelectorAll('input[data-key]')].map(i => [i.dataset.key, i.value.trim()]));
    if (!song.title && !song.artist && !song.url) return;
    const { cover, file } = row.songCover();
    song.cover = cover;
    if (file) {
      song.coverFile = `songCover_${songs.length}`;
      data.append(song.coverFile, file);
    }
    songs.push(song);
  });
  data.append('songs', JSON.stringify(songs));
}

function wireSongEditor(form, songs = []) {
  const editor = form.querySelector('.song-editor');
  editor.replaceChildren();
  songs.forEach(song => addSongRow(editor, song));
  form.querySelector('.add-song').addEventListener('click', () => {
    addSongRow(editor);
    editor.lastElementChild.querySelector('input').focus();
  });
}

// ---------- Producer list (producers on a beat) ----------

function addProducerRow(list, name = '') {
  const row = document.createElement('div');
  row.className = 'link-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'producer name';
  input.maxLength = 120;
  input.value = name;

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'button secondary';
  remove.textContent = '✕';
  remove.setAttribute('aria-label', 'Remove producer');
  remove.addEventListener('click', () => row.remove());

  row.append(input, remove);
  list.append(row);
}

// Starts with one empty box so a single producer needs no extra click.
function wireProducerList(form, producers = []) {
  const list = form.querySelector('.producer-list');
  list.replaceChildren();
  (producers.length ? producers : ['']).forEach(name => addProducerRow(list, name));
  form.querySelector('.add-producer').addEventListener('click', () => {
    addProducerRow(list);
    list.lastElementChild.querySelector('input').focus();
  });
}

function readProducers(form) {
  return [...form.querySelectorAll('.producer-list input')].map(i => i.value.trim()).filter(Boolean);
}

document.querySelectorAll('.add-link').forEach(button => {
  button.addEventListener('click', () => {
    const editor = button.parentElement.querySelector('.link-editor');
    addLinkRow(editor);
    editor.lastElementChild.querySelector('input').focus();
  });
});

// ---------- Home ----------

const homeForm = document.getElementById('home-form');
let homeKeptGifs = [];

function fillHome(home) {
  homeForm.headline.value = home.headline || '';
  homeForm.bigText.value = home.bigText || '';
  homeForm.paragraph.value = home.paragraph || '';
  homeForm.collageGifs.value = '';
  homeKeptGifs = (home.collageGifs || []).slice();
  renderCollageGifList();
  renderPresetList();
  fillLinks(homeForm.querySelector('.link-editor'), home.links);
}

function renderCollageGifList() {
  const list = homeForm.querySelector('.collage-gif-list');
  list.replaceChildren(...homeKeptGifs.map((url, i) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:inline-block;position:relative;margin:4px;';
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.style.cssText = 'width:100px;height:70px;object-fit:cover;border-radius:6px;border:1px solid #333;';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '✕';
    btn.style.cssText = 'position:absolute;top:2px;right:2px;background:#e00;color:#fff;border:none;border-radius:50%;width:20px;height:20px;font-size:12px;cursor:pointer;line-height:1;';
    btn.addEventListener('click', () => { homeKeptGifs.splice(i, 1); renderCollageGifList(); });
    wrap.append(img, btn);
    return wrap;
  }));
}

homeForm.addEventListener('submit', async e => {
  e.preventDefault();
  const data = new FormData();
  data.append('headline', homeForm.headline.value);
  data.append('bigText', homeForm.bigText.value);
  data.append('paragraph', homeForm.paragraph.value);
  data.append('links', JSON.stringify(readLinks(homeForm.querySelector('.link-editor'))));
  data.append('keptGifs', JSON.stringify(homeKeptGifs));
  for (const file of homeForm.collageGifs.files) {
    data.append('collageGifs', file);
  }

  setBusy(homeForm, true);
  setStatus(homeForm, 'saving…');
  try {
    content = await send('PUT', '/api/admin/home', data, p => setStatus(homeForm, `uploading… ${Math.round(p * 100)}%`));
    fillHome(content.home);
    setStatus(homeForm, 'saved ✓');
  } catch (err) {
    setStatus(homeForm, err.message, true);
  } finally {
    setBusy(homeForm, false);
  }
});

// ---------- Home presets ----------

function renderPresetList() {
  const list = homeForm.querySelector('.preset-list');
  const presets = content.homePresets || [];
  if (!presets.length) {
    list.innerHTML = '<p style="color:#888;font-size:13px;">no presets saved yet</p>';
    return;
  }
  list.replaceChildren(...presets.map((preset, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #222;';
    const name = document.createElement('span');
    name.textContent = preset.name;
    name.style.cssText = 'flex:1;font-size:14px;';
    const count = document.createElement('span');
    count.textContent = `${preset.gifs.length} gif${preset.gifs.length !== 1 ? 's' : ''}`;
    count.style.cssText = 'color:#888;font-size:12px;';
    const loadBtn = document.createElement('button');
    loadBtn.type = 'button';
    loadBtn.className = 'button secondary';
    loadBtn.textContent = 'load';
    loadBtn.style.cssText = 'font-size:12px;padding:4px 10px;';
    loadBtn.addEventListener('click', () => {
      homeKeptGifs = preset.gifs.slice();
      renderCollageGifList();
    });
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'button danger';
    delBtn.textContent = 'delete';
    delBtn.style.cssText = 'font-size:12px;padding:4px 10px;';
    delBtn.addEventListener('click', async () => {
      try {
        content = await send('DELETE', `/api/admin/home-presets/${i}`);
        renderPresetList();
      } catch (err) {
        setStatus(homeForm, err.message, true);
      }
    });
    row.append(name, count, loadBtn, delBtn);
    return row;
  }));
}

homeForm.querySelector('.save-preset')?.addEventListener('click', async () => {
  const input = homeForm.querySelector('.preset-name-input');
  const name = input.value.trim();
  if (!name) { input.focus(); return; }
  if (!homeKeptGifs.length) { setStatus(homeForm, 'add some gifs first', true); return; }
  try {
    content = await send('POST', '/api/admin/home-presets', { name, gifs: JSON.stringify(homeKeptGifs) });
    input.value = '';
    renderPresetList();
    setStatus(homeForm, 'preset saved ✓');
  } catch (err) {
    setStatus(homeForm, err.message, true);
  }
});

// ---------- Art ----------

const artForm = document.getElementById('art-upload');
const artStaging = artForm.querySelector('.art-staging');
const MAX_ART_UPLOAD = 30;
let staged = [];

// Reads an image's pixel size so the public collage can reserve its space.
function imageSize(file) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: null, height: null });
    img.src = URL.createObjectURL(file);
  });
}

function renderStaging() {
  artStaging.replaceChildren(...staged.map(item => {
    const row = document.createElement('div');
    row.className = 'link-row art-row';
    const thumb = document.createElement('img');
    thumb.className = 'art-thumb';
    thumb.src = item.preview;
    thumb.alt = '';
    const title = document.createElement('input');
    title.type = 'text';
    title.placeholder = 'title (optional)';
    title.maxLength = 200;
    title.value = item.title;
    title.addEventListener('input', () => { item.title = title.value; });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button secondary';
    remove.textContent = '✕';
    remove.setAttribute('aria-label', 'Remove this image');
    remove.addEventListener('click', () => {
      staged = staged.filter(s => s !== item);
      renderStaging();
    });
    row.append(thumb, title, remove);
    return row;
  }));
}

artForm.images.addEventListener('change', () => {
  const files = [...artForm.images.files];
  artForm.images.value = '';
  const room = MAX_ART_UPLOAD - staged.length;
  files.slice(0, room).forEach(file => staged.push({ file, title: '', preview: URL.createObjectURL(file) }));
  renderStaging();
  setStatus(artForm, files.length > room ? `only ${MAX_ART_UPLOAD} images fit in one upload` : '', files.length > room);
});

artForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (!staged.length) return setStatus(artForm, 'pick at least one image first', true);

  setBusy(artForm, true);
  setStatus(artForm, 'preparing…');
  try {
    const sizes = await Promise.all(staged.map(item => imageSize(item.file)));
    const data = new FormData();
    data.append('details', JSON.stringify(staged.map((item, i) => ({ title: item.title.trim(), ...sizes[i] }))));
    staged.forEach(item => data.append('images', item.file));
    content = await send('POST', '/api/admin/art', data, p => setStatus(artForm, `uploading… ${Math.round(p * 100)}%`));
    const count = staged.length;
    staged = [];
    renderStaging();
    renderArt(content.art);
    setStatus(artForm, `uploaded ${count} ✓`);
  } catch (err) {
    setStatus(artForm, err.message, true);
  } finally {
    setBusy(artForm, false);
  }
});

function artEditor(piece, index, total) {
  const form = document.createElement('form');
  form.className = 'admin-card admin-art';

  const thumb = document.createElement('img');
  thumb.className = 'art-thumb large';
  thumb.src = piece.image;
  thumb.alt = '';
  thumb.loading = 'lazy';

  const fields = document.createElement('div');
  fields.className = 'admin-beat-fields';
  const label = document.createElement('label');
  label.className = 'field';
  label.innerHTML = '<span>title (optional)</span>';
  const title = document.createElement('input');
  title.type = 'text';
  title.maxLength = 200;
  title.value = piece.title;
  label.append(title);

  const buttons = document.createElement('div');
  buttons.className = 'button-row';
  buttons.innerHTML = `
    <button type="submit" class="button">save</button>
    <button type="button" class="button secondary move-up" aria-label="Move up">↑</button>
    <button type="button" class="button secondary move-down" aria-label="Move down">↓</button>
    <button type="button" class="button danger delete">delete</button>
    <span class="status" role="status"></span>`;
  fields.append(label, buttons);
  form.append(thumb, fields);

  buttons.querySelector('.move-up').disabled = index === 0;
  buttons.querySelector('.move-down').disabled = index === total - 1;

  async function run(action, message) {
    setBusy(form, true);
    setStatus(form, message);
    try {
      content = await action();
      renderArt(content.art);
    } catch (err) {
      setStatus(form, err.message, true);
      setBusy(form, false);
    }
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    run(() => send('PUT', `/api/admin/art/${piece.id}`, { title: title.value }), 'saving…');
  });
  buttons.querySelector('.move-up').addEventListener('click', () =>
    run(() => send('POST', `/api/admin/art/${piece.id}/move`, { direction: 'up' }), 'moving…'));
  buttons.querySelector('.move-down').addEventListener('click', () =>
    run(() => send('POST', `/api/admin/art/${piece.id}/move`, { direction: 'down' }), 'moving…'));
  buttons.querySelector('.delete').addEventListener('click', () => {
    if (!confirm(`Delete ${piece.title ? `“${piece.title}”` : 'this artwork'}? This can’t be undone.`)) return;
    run(() => send('DELETE', `/api/admin/art/${piece.id}`), 'deleting…');
  });
  return form;
}

function renderArt(art) {
  document.querySelector('.admin-art-list').replaceChildren(...art.map((piece, i) => artEditor(piece, i, art.length)));
  document.querySelector('#panel-art .empty-note').hidden = art.length > 0;
}

// ---------- Clips ----------

const clipForm = document.getElementById('clip-upload');
const clipPeopleList = clipForm?.querySelector('.clip-people-list');

function addClipPersonRow(list, name = '') {
  const row = document.createElement('div');
  row.className = 'link-row';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'person name';
  input.maxLength = 120;
  input.value = name;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'button secondary';
  remove.textContent = '✕';
  remove.setAttribute('aria-label', 'Remove person');
  remove.addEventListener('click', () => row.remove());
  row.append(input, remove);
  list.append(row);
}

function readClipPeople(list) {
  return [...list.querySelectorAll('input')].map(i => i.value.trim()).filter(Boolean);
}

if (clipForm) {
  addClipPersonRow(clipPeopleList);
  clipForm.querySelector('.add-clip-person').addEventListener('click', () => {
    addClipPersonRow(clipPeopleList);
    clipPeopleList.lastElementChild.querySelector('input').focus();
  });

  clipForm.video.addEventListener('change', () => {
    const file = clipForm.video.files[0];
    if (file && !clipForm.title.value) clipForm.title.value = file.name.replace(/\.[^.]+$/, '');
  });

  clipForm.addEventListener('submit', async e => {
    e.preventDefault();
    const video = clipForm.video.files[0];
    if (!video) return;

    setBusy(clipForm, true);
    setStatus(clipForm, 'reading video…');
    try {
      const duration = await new Promise(resolve => {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.onloadedmetadata = () => resolve(v.duration);
        v.onerror = () => resolve(null);
        v.src = URL.createObjectURL(video);
      });
      const data = new FormData();
      data.append('title', clipForm.title.value);
      data.append('date', clipForm.date.value);
      data.append('game', clipForm.game.value);
      data.append('people', JSON.stringify(readClipPeople(clipPeopleList)));
      if (duration) data.append('duration', duration);
      data.append('video', video);

      content = await send('POST', '/api/admin/clips', data, p => setStatus(clipForm, `uploading… ${Math.round(p * 100)}%`));
      renderClipsAdmin(content.clips);
      clipForm.reset();
      clipPeopleList.replaceChildren();
      addClipPersonRow(clipPeopleList);
      setStatus(clipForm, 'uploaded ✓');
    } catch (err) {
      setStatus(clipForm, err.message, true);
    } finally {
      setBusy(clipForm, false);
    }
  });
}

function clipEditor(clip) {
  const card = document.createElement('div');
  card.className = 'admin-card';
  card.style.cssText = 'display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;';

  const video = document.createElement('video');
  video.src = clip.video;
  video.controls = true;
  video.preload = 'metadata';
  video.style.cssText = 'width:200px;border-radius:6px;';

  const fields = document.createElement('div');
  fields.style.cssText = 'flex:1;min-width:200px;';

  const titleP = document.createElement('p');
  titleP.style.cssText = 'font-weight:600;color:#fff;margin:0 0 4px;';
  titleP.textContent = clip.title;

  const metaP = document.createElement('p');
  metaP.style.cssText = 'font-size:13px;color:#888;margin:0 0 8px;';
  const parts = [];
  if (clip.date) parts.push(clip.date);
  if (clip.duration) {
    const m = Math.floor(clip.duration / 60);
    const s = Math.round(clip.duration % 60);
    parts.push(m + ':' + String(s).padStart(2, '0'));
  }
  if (clip.game) parts.push(clip.game);
  if (clip.people?.length) parts.push(clip.people.join(', '));
  metaP.textContent = parts.join(' · ');

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'button danger';
  del.textContent = 'delete';
  del.addEventListener('click', async () => {
    if (!confirm(`Delete "${clip.title}"? This can't be undone.`)) return;
    del.disabled = true;
    try {
      content = await send('DELETE', `/api/admin/clips/${clip.id}`);
      renderClipsAdmin(content.clips);
    } catch (err) {
      del.disabled = false;
      alert(err.message);
    }
  });

  fields.append(titleP, metaP, del);
  card.append(video, fields);
  return card;
}

function renderClipsAdmin(clips) {
  const list = document.querySelector('.admin-clip-list');
  if (list) {
    list.replaceChildren(...(clips || []).map(clipEditor));
    document.querySelector('#panel-clips .empty-note').hidden = clips?.length > 0;
  }
}

// ---------- Election ----------

const electionForm = document.getElementById('election-form');
const candidateList = electionForm?.querySelector('.election-candidate-list');
const sectionList = electionForm?.querySelector('.election-section-list');
const mapPreview = electionForm?.querySelector('.election-map-preview');
let electionKeptMap = '';
let currentElectionSlug = '';

const slugSelect = document.getElementById('election-slug-select');
const newSlugInput = document.getElementById('new-election-slug');
const createBtn = document.getElementById('create-election-btn');
const deleteBtn = document.getElementById('delete-election-btn');
const viewLink = document.getElementById('election-view-link');

function populateElectionSelect(elections) {
  if (!slugSelect) return;
  const prev = currentElectionSlug;
  slugSelect.innerHTML = '<option value="">— select an election year —</option>';
  Object.keys(elections).sort((a, b) => b.localeCompare(a)).forEach(slug => {
    const opt = document.createElement('option');
    opt.value = slug;
    opt.textContent = elections[slug].title || slug;
    slugSelect.append(opt);
  });
  if (prev && elections[prev]) {
    slugSelect.value = prev;
    selectElection(prev);
  } else {
    selectElection('');
  }
}

function selectElection(slug) {
  currentElectionSlug = slug;
  if (slug && content?.elections?.[slug]) {
    electionForm.hidden = false;
    fillElection(content.elections[slug]);
    if (viewLink) viewLink.href = `/#election-${slug}`;
  } else {
    electionForm.hidden = true;
    currentElectionSlug = '';
  }
}

if (slugSelect) {
  slugSelect.addEventListener('change', () => selectElection(slugSelect.value));
}

if (createBtn) {
  createBtn.addEventListener('click', async () => {
    const slug = newSlugInput.value.trim().replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
    if (!slug) return;
    if (content.elections[slug]) {
      slugSelect.value = slug;
      selectElection(slug);
      return;
    }
    content.elections[slug] = { title: slug + ' United States presidential election' };
    populateElectionSelect(content.elections);
    slugSelect.value = slug;
    selectElection(slug);
    newSlugInput.value = '';
  });
}

if (deleteBtn) {
  deleteBtn.addEventListener('click', async () => {
    if (!currentElectionSlug) return;
    if (!confirm(`Delete election "${currentElectionSlug}"? This cannot be undone.`)) return;
    try {
      content = await send('DELETE', `/api/admin/elections/${currentElectionSlug}`);
      currentElectionSlug = '';
      populateElectionSelect(content.elections || {});
    } catch (err) { alert(err.message); }
  });
}

function addCandidateRow(list, c = {}) {
  const row = document.createElement('div');
  row.className = 'admin-card';
  row.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:12px;';
  row.innerHTML = `
    <div class="field-row">
      <label class="field"><span>name</span><input type="text" data-key="name" maxlength="200"></label>
      <label class="field"><span>party</span><input type="text" data-key="party" maxlength="120"></label>
    </div>
    <div class="field-row">
      <label class="field"><span>party color</span><input type="color" data-key="partyColor" value="#cccccc"></label>
      <label class="field"><span>color name</span><input type="text" data-key="partyColorName" maxlength="40" placeholder="e.g. light blue"></label>
      <label class="field"><span>home state</span><input type="text" data-key="homeState" maxlength="100"></label>
    </div>
    <div class="field-row">
      <label class="field"><span>running mate</span><input type="text" data-key="runningMate" maxlength="200"></label>
      <label class="field"><span>electoral votes</span><input type="text" data-key="electoralVotes" maxlength="20"></label>
    </div>
    <div class="field-row">
      <label class="field"><span>popular votes</span><input type="text" data-key="popularVotes" maxlength="30"></label>
      <label class="field"><span>popular %</span><input type="text" data-key="popularPct" maxlength="20"></label>
    </div>
    <label class="field"><span>states carried</span><input type="text" data-key="statesCarried" maxlength="100" placeholder="31 + ME-02"></label>
    <label class="field"><span>candidate photo</span><input type="file" data-key="photo" accept="image/jpeg,image/png,image/gif,image/webp"></label>
    <div style="display:flex;align-items:center;gap:8px;">
      <img class="candidate-photo-preview" alt="" style="width:60px;height:60px;object-fit:cover;border-radius:4px;display:none;">
      <button type="button" class="button danger remove-candidate" style="margin-left:auto;">remove</button>
    </div>`;
  const nameInput = row.querySelector('[data-key="name"]');
  nameInput.value = c.name || '';
  nameInput.addEventListener('input', buildMapColorPicker);
  row.querySelector('[data-key="party"]').value = c.party || '';
  const partyColorInput = row.querySelector('[data-key="partyColor"]');
  partyColorInput.value = c.partyColor || '#cccccc';
  partyColorInput.addEventListener('input', () => { buildMapColorPicker(); computeElectoralVotes(); });
  row.querySelector('[data-key="partyColorName"]').value = c.partyColorName || '';
  row.querySelector('[data-key="homeState"]').value = c.homeState || '';
  row.querySelector('[data-key="runningMate"]').value = c.runningMate || '';
  row.querySelector('[data-key="electoralVotes"]').value = c.electoralVotes || '';
  row.querySelector('[data-key="popularVotes"]').value = c.popularVotes || '';
  row.querySelector('[data-key="popularPct"]').value = c.popularPct || '';
  row.querySelector('[data-key="statesCarried"]').value = c.statesCarried || '';
  const preview = row.querySelector('.candidate-photo-preview');
  if (c.image) { preview.src = c.image; preview.style.display = 'block'; }
  row._keptImage = c.image || '';
  row._newFile = null;
  const fileInput = row.querySelector('[data-key="photo"]');
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) {
      row._newFile = fileInput.files[0];
      preview.src = URL.createObjectURL(fileInput.files[0]);
      preview.style.display = 'block';
    }
  });
  row.querySelector('.remove-candidate').addEventListener('click', () => { row.remove(); buildMapColorPicker(); computeElectoralVotes(); });
  list.append(row);
}

function addSectionRow(list, s = {}) {
  const row = document.createElement('div');
  row.className = 'admin-card';
  row.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:12px;';
  row.innerHTML = `
    <label class="field"><span>heading</span><input type="text" data-key="heading" maxlength="300"></label>
    <label class="field"><span>text</span><textarea data-key="text" maxlength="10000" rows="4"></textarea></label>
    <button type="button" class="button danger remove-section" style="align-self:flex-start;">remove</button>`;
  row.querySelector('[data-key="heading"]').value = s.heading || '';
  row.querySelector('[data-key="text"]').value = s.text || '';
  row.querySelector('.remove-section').addEventListener('click', () => row.remove());
  list.append(row);
}

let electionStateColors = {};

function buildMapColorPicker() {
  const picker = document.getElementById('map-color-picker');
  if (!picker) return;
  const prev = picker.querySelector('[name="mapColor"]:checked')?.value || '';
  picker.innerHTML = '';

  const candidateRows = [...(candidateList?.children || [])];
  candidateRows.forEach((row, i) => {
    const color = row.querySelector('[data-key="partyColor"]')?.value || '#cccccc';
    const name = row.querySelector('[data-key="name"]')?.value || `Candidate ${i + 1}`;
    const label = document.createElement('label');
    label.innerHTML = `<input type="radio" name="mapColor" value="${color}"> <span class="map-swatch" style="background:${color}"></span> ${name.split(' ').pop()}`;
    picker.append(label);
  });

  const noneLabel = document.createElement('label');
  noneLabel.innerHTML = '<input type="radio" name="mapColor" value="#d0d0d0"> <span class="map-swatch" style="background:#d0d0d0"></span> None';
  picker.append(noneLabel);

  const customLabel = document.createElement('label');
  customLabel.className = 'map-custom-label';
  customLabel.innerHTML = '<input type="radio" name="mapColor" value="custom"> <input type="color" class="map-custom-color" value="#ffcc00"> Custom';
  customLabel.querySelector('.map-custom-color').addEventListener('input', () => {
    customLabel.querySelector('[name="mapColor"]').checked = true;
  });
  picker.append(customLabel);

  // Restore previous selection or default to first
  const match = picker.querySelector(`[name="mapColor"][value="${prev}"]`);
  if (match) match.checked = true;
  else if (picker.querySelector('[name="mapColor"]')) picker.querySelector('[name="mapColor"]').checked = true;
}

function initMapEditor() {
  const svg = electionForm?.querySelector('.map-editor-svg');
  if (!svg || typeof US_STATES === 'undefined') return;
  svg.innerHTML = '';
  US_STATES.forEach(s => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', s.path);
    path.setAttribute('data-state', s.id);
    path.setAttribute('fill', electionStateColors[s.id] || '#d0d0d0');
    path.setAttribute('stroke', '#fff');
    path.setAttribute('stroke-width', '1.5');
    path.style.cursor = 'pointer';
    path.addEventListener('click', () => {
      const radios = electionForm.querySelectorAll('[name="mapColor"]');
      let color = '#d0d0d0';
      for (const r of radios) { if (r.checked) { color = r.value; break; } }
      if (color === 'custom') color = electionForm.querySelector('.map-custom-color').value;
      path.setAttribute('fill', color);
      electionStateColors[s.id] = color;
      computeElectoralVotes();
    });
    svg.append(path);
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', s.labelX);
    text.setAttribute('y', s.labelY);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('font-size', '10');
    text.setAttribute('fill', '#000');
    text.setAttribute('pointer-events', 'none');
    text.setAttribute('font-family', 'Inter, sans-serif');
    text.setAttribute('font-weight', '600');
    text.textContent = s.abbr;
    svg.append(text);
  });
}

function getActiveCensusAdmin() {
  if (!currentElectionSlug || !content?.censusData) return null;
  const yearMatch = currentElectionSlug.match(/\d{4}/);
  if (!yearMatch) return null;
  const electionYear = parseInt(yearMatch[0]);
  const censusYears = Object.keys(content.censusData).map(Number).filter(y => !isNaN(y) && y < electionYear).sort((a, b) => b - a);
  return censusYears.length ? content.censusData[String(censusYears[0])] : null;
}

function parseHex(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function colorDistance(a, b) {
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  return (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2;
}

function computeElectoralVotes() {
  const tally = document.getElementById('ev-tally');
  if (!tally || typeof US_STATES === 'undefined') return;
  const candidateRows = [...(candidateList?.children || [])];
  if (!candidateRows.length || !Object.keys(electionStateColors).length) {
    tally.hidden = true;
    return;
  }

  const activeCensus = getActiveCensusAdmin();
  const evByState = {};
  US_STATES.forEach(s => { evByState[s.id] = activeCensus?.[s.id] ?? s.ev; });

  const candidates = candidateRows.map(row => ({
    color: row.querySelector('[data-key="partyColor"]')?.value || '',
    name: row.querySelector('[data-key="name"]')?.value || '',
    evInput: row.querySelector('[data-key="electoralVotes"]'),
  }));

  const evTotals = candidates.map(() => 0);
  const threshold = 120 * 120;
  for (const [stateId, color] of Object.entries(electionStateColors)) {
    if (!color || color === '#d0d0d0') continue;
    let bestIdx = -1;
    let bestDist = Infinity;
    candidates.forEach((c, i) => {
      if (!c.color || c.color === '#cccccc') return;
      const dist = colorDistance(color, c.color);
      if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    });
    if (bestIdx >= 0 && bestDist < threshold && evByState[stateId]) {
      evTotals[bestIdx] += evByState[stateId];
    }
  }

  candidates.forEach((c, i) => {
    if (c.evInput) c.evInput.value = evTotals[i] || '';
  });

  const parts = candidates.map((c, i) => {
    const label = c.name ? c.name.split(' ').pop() : `Candidate ${i + 1}`;
    return `<span style="color:${c.color};font-weight:600">${label}: ${evTotals[i]}</span>`;
  }).filter((_, i) => evTotals[i] > 0);

  if (parts.length) {
    tally.innerHTML = 'EV count: ' + parts.join(' &middot; ');
    tally.hidden = false;
  } else {
    tally.hidden = true;
  }
}

function fillElection(election) {
  if (!electionForm) return;
  electionForm.title.value = election.title || '';
  electionForm.lead.value = election.lead || '';
  electionForm.highlightWords.value = election.highlightWords || '';
  electionForm.infobox.value = election.infobox || '';
  electionForm.electionDate.value = election.electionDate || '';
  electionForm.turnout.value = election.turnout || '';
  electionForm.turnoutChange.value = election.turnoutChange || '';
  electionForm.mapCaption.value = election.mapCaption || '';
  electionForm.presidentBefore.value = election.presidentBefore || '';
  electionForm.presidentBeforeParty.value = election.presidentBeforeParty || '';
  electionForm.electedPresident.value = election.electedPresident || '';
  electionForm.electedPresidentParty.value = election.electedPresidentParty || '';
  electionKeptMap = election.mapImage || '';
  if (electionKeptMap) { mapPreview.src = electionKeptMap; mapPreview.hidden = false; }
  else mapPreview.hidden = true;
  electionForm.querySelector('[name="removeMap"]').parentElement.hidden = !electionKeptMap;
  electionStateColors = election.stateColors ? { ...election.stateColors } : {};
  initMapEditor();
  candidateList.replaceChildren();
  (election.candidates || []).forEach(c => addCandidateRow(candidateList, c));
  sectionList.replaceChildren();
  (election.sections || []).forEach(s => addSectionRow(sectionList, s));
  buildMapColorPicker();
  computeElectoralVotes();
}

// Partisan lean per state: negative = Dem-leaning, positive = Rep-leaning (approximate PVI-style values)
const STATE_LEAN = {AL:15,AK:9,AZ:1,AR:16,CA:-15,CO:-5,CT:-7,DE:-7,FL:3,GA:1,HI:-19,ID:19,IL:-8,IN:8,IA:6,KS:10,KY:15,LA:12,ME:-3,MD:-14,MA:-16,MI:0,MN:-1,MS:8,MO:9,MT:8,NE:10,NV:-1,NH:-1,NJ:-6,NM:-5,NY:-12,NC:2,ND:17,OH:6,OK:20,OR:-6,PA:0,RI:-10,SC:8,SD:14,TN:14,TX:5,UT:12,VT:-16,VA:-3,WA:-8,WV:20,WI:0,WY:25,DC:-40};

function randomizeElection() {
  const candidateRows = [...(candidateList?.children || [])];
  if (candidateRows.length < 2) { alert('Add at least 2 candidates with party colors first.'); return; }
  const mode = document.getElementById('randomize-mode').value;
  const activeCensus = getActiveCensusAdmin();

  const candidates = candidateRows.map(row => ({
    color: row.querySelector('[data-key="partyColor"]')?.value || '#cccccc',
    name: row.querySelector('[data-key="name"]')?.value || '',
    evInput: row.querySelector('[data-key="electoralVotes"]'),
    pvInput: row.querySelector('[data-key="popularVotes"]'),
    pctInput: row.querySelector('[data-key="popularPct"]'),
    scInput: row.querySelector('[data-key="statesCarried"]'),
  }));

  const evByState = {};
  US_STATES.forEach(s => { evByState[s.id] = activeCensus?.[s.id] ?? s.ev; });
  const stateIds = US_STATES.map(s => s.id);

  if (mode === 'realistic') {
    // Pick a national swing: first candidate is the "left" one, second is "right"
    // Additional candidates are third parties with lower support
    const swing = (Math.random() - 0.5) * 20; // national environment -10 to +10
    const thirdPartyStrength = candidates.length > 2 ? 0.03 + Math.random() * 0.12 : 0;

    stateIds.forEach(id => {
      const lean = STATE_LEAN[id] || 0;
      const adjusted = lean + swing + (Math.random() - 0.5) * 8;
      if (candidates.length <= 2) {
        candidates[adjusted < 0 ? 0 : 1]._states = (candidates[adjusted < 0 ? 0 : 1]._states || []);
        candidates[adjusted < 0 ? 0 : 1]._states.push(id);
        electionStateColors[id] = candidates[adjusted < 0 ? 0 : 1].color;
      } else {
        // Third+ parties win their home states or random upsets
        let winner = adjusted < 0 ? 0 : 1;
        for (let i = 2; i < candidates.length; i++) {
          if (Math.random() < (thirdPartyStrength * (1 + Math.random())) && Math.abs(adjusted) < 8) {
            winner = i;
            break;
          }
        }
        candidates[winner]._states = (candidates[winner]._states || []);
        candidates[winner]._states.push(id);
        electionStateColors[id] = candidates[winner].color;
      }
    });

    // Generate realistic popular vote
    const totalVoters = 130000000 + Math.floor(Math.random() * 40000000);
    let remaining = 1;
    const shares = [];
    // Main two candidates split most of the vote
    const mainShare = 0.90 - thirdPartyStrength * (candidates.length - 2);
    const frontRunner = swing < 0 ? 0 : 1;
    const margin = 0.01 + Math.random() * 0.08;
    shares[frontRunner] = (mainShare / 2) + margin / 2;
    shares[frontRunner === 0 ? 1 : 0] = (mainShare / 2) - margin / 2;
    remaining -= shares[0] + shares[1];
    for (let i = 2; i < candidates.length; i++) {
      const share = i === candidates.length - 1 ? remaining : remaining * (0.3 + Math.random() * 0.5);
      shares[i] = share;
      remaining -= share;
    }

    candidates.forEach((c, i) => {
      const pv = Math.round(totalVoters * (shares[i] || 0));
      const pct = ((shares[i] || 0) * 100).toFixed(2) + '%';
      if (c.pvInput) c.pvInput.value = pv.toLocaleString('en-US');
      if (c.pctInput) c.pctInput.value = pct;
    });
  } else {
    // Completely random: each state assigned to a random candidate with equal probability
    stateIds.forEach(id => {
      const winner = Math.floor(Math.random() * candidates.length);
      candidates[winner]._states = (candidates[winner]._states || []);
      candidates[winner]._states.push(id);
      electionStateColors[id] = candidates[winner].color;
    });

    // Random popular vote
    const totalVoters = 100000000 + Math.floor(Math.random() * 70000000);
    const raw = candidates.map(() => Math.random());
    const sum = raw.reduce((a, b) => a + b, 0);
    candidates.forEach((c, i) => {
      const share = raw[i] / sum;
      const pv = Math.round(totalVoters * share);
      const pct = (share * 100).toFixed(2) + '%';
      if (c.pvInput) c.pvInput.value = pv.toLocaleString('en-US');
      if (c.pctInput) c.pctInput.value = pct;
    });
  }

  // Fill states carried for each candidate
  candidates.forEach(c => {
    const states = c._states || [];
    const abbrs = states.filter(id => id !== 'DC').sort();
    const hasDC = states.includes('DC');
    const parts = [];
    if (abbrs.length) parts.push(String(abbrs.length));
    if (hasDC) parts.push('DC');
    // Check for split-EV states (ME, NE) - just list the abbreviation
    if (c.scInput) c.scInput.value = parts.join(' + ');
    delete c._states;
  });

  initMapEditor();
  computeElectoralVotes();
}

if (electionForm) {
  electionForm.querySelector('.add-candidate').addEventListener('click', () => { addCandidateRow(candidateList); buildMapColorPicker(); });
  electionForm.querySelector('.add-section').addEventListener('click', () => addSectionRow(sectionList));
  electionForm.querySelector('.clear-map').addEventListener('click', () => {
    electionStateColors = {};
    initMapEditor();
    computeElectoralVotes();
  });
  document.getElementById('randomize-btn')?.addEventListener('click', randomizeElection);
  electionForm.mapImage.addEventListener('change', () => {
    if (electionForm.mapImage.files[0]) {
      mapPreview.src = URL.createObjectURL(electionForm.mapImage.files[0]);
      mapPreview.hidden = false;
    }
  });
  initMapEditor();

  electionForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!currentElectionSlug) { setStatus(electionForm, 'select an election year first', true); return; }
    const data = new FormData();
    data.append('title', electionForm.title.value);
    data.append('lead', electionForm.lead.value);
    data.append('highlightWords', electionForm.highlightWords.value);
    data.append('infobox', electionForm.infobox.value);
    data.append('electionDate', electionForm.electionDate.value);
    data.append('turnout', electionForm.turnout.value);
    data.append('turnoutChange', electionForm.turnoutChange.value);
    data.append('stateColors', JSON.stringify(electionStateColors));
    data.append('mapCaption', electionForm.mapCaption.value);
    data.append('presidentBefore', electionForm.presidentBefore.value);
    data.append('presidentBeforeParty', electionForm.presidentBeforeParty.value);
    data.append('electedPresident', electionForm.electedPresident.value);
    data.append('electedPresidentParty', electionForm.electedPresidentParty.value);

    if (electionForm.mapImage.files[0]) data.append('mapImage', electionForm.mapImage.files[0]);
    else if (!electionForm.removeMap?.checked) data.append('keptMapImage', electionKeptMap);

    const candidates = [...candidateList.children].map((row, i) => {
      const c = {};
      row.querySelectorAll('[data-key]').forEach(el => {
        if (el.type !== 'file') c[el.dataset.key] = el.value;
      });
      c.keptImage = row._keptImage || '';
      if (row._newFile) {
        const f = new File([row._newFile], `candidate_${i}`, { type: row._newFile.type });
        data.append('candidateImage', f);
      }
      return c;
    });
    data.append('candidates', JSON.stringify(candidates));

    const sections = [...sectionList.children].map(row => ({
      heading: row.querySelector('[data-key="heading"]').value,
      text: row.querySelector('[data-key="text"]').value,
    }));
    data.append('sections', JSON.stringify(sections));

    setBusy(electionForm, true);
    setStatus(electionForm, 'saving...');
    try {
      content = await send('PUT', `/api/admin/elections/${currentElectionSlug}`, data, p => setStatus(electionForm, `uploading... ${Math.round(p * 100)}%`));
      fillElection(content.elections[currentElectionSlug] || {});
      populateElectionSelect(content.elections || {});
      setStatus(electionForm, 'saved ✓');
    } catch (err) {
      setStatus(electionForm, err.message, true);
    } finally {
      setBusy(electionForm, false);
    }
  });
}

// ---------- census ----------

const STATE_NAMES = {AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'District of Columbia'};
const STATE_ORDER = Object.keys(STATE_NAMES).sort((a, b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b]));

const censusYearSelect = document.getElementById('census-year-select');
const newCensusYear = document.getElementById('new-census-year');
const createCensusBtn = document.getElementById('create-census-btn');
const deleteCensusBtn = document.getElementById('delete-census-btn');
const censusEditor = document.getElementById('census-editor');
const censusEditorTitle = document.getElementById('census-editor-title');
const censusStateGrid = document.getElementById('census-state-grid');
const censusTotal = document.getElementById('census-total');
const saveCensusBtn = document.getElementById('save-census-btn');
const censusStatus = document.getElementById('census-status');
let currentCensusYear = '';

function populateCensusSelect(censusData) {
  if (!censusYearSelect) return;
  const prev = currentCensusYear;
  censusYearSelect.innerHTML = '<option value="">— select a census year —</option>';
  Object.keys(censusData).sort((a, b) => b.localeCompare(a)).forEach(year => {
    const opt = document.createElement('option');
    opt.value = year;
    opt.textContent = year + ' Census';
    censusYearSelect.append(opt);
  });
  if (prev && censusData[prev]) {
    censusYearSelect.value = prev;
    selectCensus(prev);
  } else {
    selectCensus('');
  }
}

function updateCensusTotal() {
  let total = 0;
  censusStateGrid.querySelectorAll('input[type="number"]').forEach(inp => {
    total += parseInt(inp.value) || 0;
  });
  censusTotal.textContent = total;
  censusTotal.style.color = total === 538 ? '' : '#d33';
}

function selectCensus(year) {
  currentCensusYear = year;
  if (!year || !content?.censusData?.[year]) {
    censusEditor.hidden = true;
    currentCensusYear = '';
    return;
  }
  censusEditor.hidden = false;
  censusEditorTitle.textContent = year + ' Census';
  const data = content.censusData[year];
  censusStateGrid.innerHTML = '';
  STATE_ORDER.forEach(st => {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;align-items:center;gap:4px';
    const label = document.createElement('label');
    label.style.cssText = 'font-size:12px;min-width:28px;font-weight:600';
    label.textContent = st;
    label.title = STATE_NAMES[st];
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = '100';
    input.value = data[st] || 0;
    input.dataset.state = st;
    input.style.cssText = 'width:52px;padding:4px 6px;font-size:13px;border:1px solid #a2a9b1;border-radius:3px;text-align:center';
    input.addEventListener('input', updateCensusTotal);
    div.append(label, input);
    censusStateGrid.append(div);
  });
  updateCensusTotal();
}

if (censusYearSelect) {
  censusYearSelect.addEventListener('change', () => selectCensus(censusYearSelect.value));
}

if (createCensusBtn) {
  createCensusBtn.addEventListener('click', () => {
    const year = newCensusYear.value.trim().replace(/\D/g, '').slice(0, 4);
    if (!year || year.length !== 4) return;
    if (content.censusData[year]) {
      censusYearSelect.value = year;
      selectCensus(year);
      return;
    }
    // Copy from most recent existing census, or use empty
    const years = Object.keys(content.censusData).sort();
    const base = years.length ? content.censusData[years[years.length - 1]] : {};
    content.censusData[year] = { ...base };
    populateCensusSelect(content.censusData);
    censusYearSelect.value = year;
    selectCensus(year);
    newCensusYear.value = '';
  });
}

if (deleteCensusBtn) {
  deleteCensusBtn.addEventListener('click', async () => {
    if (!currentCensusYear) return;
    if (!confirm(`Delete ${currentCensusYear} census? This cannot be undone.`)) return;
    try {
      content = await send('DELETE', `/api/admin/census/${currentCensusYear}`);
      currentCensusYear = '';
      populateCensusSelect(content.censusData || {});
    } catch (err) { alert(err.message); }
  });
}

if (saveCensusBtn) {
  saveCensusBtn.addEventListener('click', async () => {
    if (!currentCensusYear) return;
    const data = {};
    censusStateGrid.querySelectorAll('input[type="number"]').forEach(inp => {
      data[inp.dataset.state] = parseInt(inp.value) || 0;
    });
    const total = Object.values(data).reduce((s, v) => s + v, 0);
    if (total !== 538) {
      censusStatus.textContent = `total is ${total}, must be 538`;
      censusStatus.classList.add('error');
      return;
    }
    censusStatus.textContent = 'saving...';
    censusStatus.classList.remove('error');
    try {
      content = await send('PUT', `/api/admin/census/${currentCensusYear}`, data);
      populateCensusSelect(content.censusData || {});
      censusStatus.textContent = 'saved ✓';
      censusStatus.classList.remove('error');
    } catch (err) {
      censusStatus.textContent = err.message;
      censusStatus.classList.add('error');
    }
  });
}

// ---------- Wiki Pages ----------

const wikiSlugSelect = document.getElementById('wiki-slug-select');
const newWikiSlug = document.getElementById('new-wiki-slug');
const createWikiBtn = document.getElementById('create-wiki-btn');
const deleteWikiBtn = document.getElementById('delete-wiki-btn');
const wikiForm = document.getElementById('wiki-form');
const wikiOfficeList = document.getElementById('wiki-office-list');
const wikiSectionList = document.getElementById('wiki-section-list');
let currentWikiSlug = '';

function populateWikiSelect(pages) {
  if (!wikiSlugSelect) return;
  const slugs = Object.keys(pages || {}).sort();
  wikiSlugSelect.innerHTML = '<option value="">— select a wiki page —</option>';
  slugs.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = pages[s].name || s;
    wikiSlugSelect.append(opt);
  });
  if (currentWikiSlug && pages[currentWikiSlug]) {
    wikiSlugSelect.value = currentWikiSlug;
  }
}

function addWikiOfficeRow(office = {}) {
  const row = document.createElement('div');
  row.style.cssText = 'border:1px solid #333;border-radius:6px;padding:12px;display:flex;flex-direction:column;gap:8px;margin-bottom:8px;';
  row.innerHTML = `
    <div class="field-row">
      <label class="field"><span>office title</span><input type="text" data-key="title" maxlength="300" placeholder="46th President of the United States"></label>
      <label class="field"><span>subtitle</span><input type="text" data-key="subtitle" maxlength="200" placeholder="In office"></label>
    </div>
    <label class="field"><span>dates</span><input type="text" data-key="dates" maxlength="200" placeholder="January 20, 2021 – January 20, 2025"></label>
    <div class="field"><span>fields (key-value pairs below the office)</span>
      <div class="wiki-office-fields"></div>
      <button type="button" class="button secondary add-office-field" style="align-self:flex-start;font-size:12px">+ add field</button>
    </div>
    <button type="button" class="button danger remove-office" style="align-self:flex-end;font-size:12px">remove office</button>`;
  row.querySelector('[data-key="title"]').value = office.title || '';
  row.querySelector('[data-key="subtitle"]').value = office.subtitle || '';
  row.querySelector('[data-key="dates"]').value = office.dates || '';
  const fieldsList = row.querySelector('.wiki-office-fields');
  (office.fields || []).forEach(f => addWikiOfficeField(fieldsList, f));
  row.querySelector('.add-office-field').addEventListener('click', () => addWikiOfficeField(fieldsList));
  row.querySelector('.remove-office').addEventListener('click', () => row.remove());
  wikiOfficeList.append(row);
}

function addWikiOfficeField(container, field = {}) {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:4px;';
  row.innerHTML = `
    <input type="text" data-key="label" maxlength="100" placeholder="Label (e.g. Vice President)" style="flex:1;padding:4px 8px;font-size:13px;border:1px solid #a2a9b1;border-radius:4px">
    <input type="text" data-key="value" maxlength="300" placeholder="Value (e.g. Kamala Harris)" style="flex:1;padding:4px 8px;font-size:13px;border:1px solid #a2a9b1;border-radius:4px">
    <button type="button" class="button danger" style="font-size:11px;padding:4px 8px">×</button>`;
  row.querySelector('[data-key="label"]').value = field.label || '';
  row.querySelector('[data-key="value"]').value = field.value || '';
  row.querySelector('.button.danger').addEventListener('click', () => row.remove());
  container.append(row);
}

const wikiEducationList = document.getElementById('wiki-education-list');

function addWikiEducationRow(edu = {}) {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:4px;';
  row.innerHTML = `
    <input type="text" data-key="school" maxlength="300" placeholder="University / College" style="flex:1;padding:4px 8px;font-size:13px;border:1px solid #a2a9b1;border-radius:4px">
    <input type="text" data-key="degree" maxlength="300" placeholder="Degree (e.g. BA, JD)" style="flex:1;padding:4px 8px;font-size:13px;border:1px solid #a2a9b1;border-radius:4px">
    <button type="button" class="button danger" style="font-size:11px;padding:4px 8px">×</button>`;
  row.querySelector('[data-key="school"]').value = edu.school || '';
  row.querySelector('[data-key="degree"]').value = edu.degree || '';
  row.querySelector('.button.danger').addEventListener('click', () => row.remove());
  wikiEducationList.append(row);
}

function addWikiSectionRow(section = {}) {
  const row = document.createElement('div');
  row.style.cssText = 'border:1px solid #333;border-radius:6px;padding:12px;display:flex;flex-direction:column;gap:8px;margin-bottom:8px;';
  row.innerHTML = `
    <label class="field"><span>heading</span><input type="text" data-key="heading" maxlength="300"></label>
    <label class="field"><span>text</span><textarea data-key="text" rows="4" maxlength="50000"></textarea></label>
    <button type="button" class="button danger remove-section" style="align-self:flex-end;font-size:12px">remove section</button>`;
  row.querySelector('[data-key="heading"]').value = section.heading || '';
  row.querySelector('[data-key="text"]').value = section.text || '';
  row.querySelector('.remove-section').addEventListener('click', () => row.remove());
  wikiSectionList.append(row);
}

function fillWikiPage(page) {
  if (!wikiForm) return;
  wikiForm.name.value = page.name || '';
  wikiForm.lead.value = page.lead || '';
  wikiForm.highlightWords.value = page.highlightWords || '';
  wikiForm.photoCaption.value = page.photoCaption || '';
  wikiForm.bornDate.value = page.bornDate || '';
  wikiForm.bornPlace.value = page.bornPlace || '';
  wikiForm.diedDate.value = page.diedDate || '';
  wikiForm.diedPlace.value = page.diedPlace || '';
  wikiForm.politicalParty.value = page.politicalParty || '';
  wikiForm.spouses.value = page.spouses || '';
  wikiForm.children.value = page.children || '';
  wikiForm.education.value = page.education || '';
  const preview = wikiForm.querySelector('.wiki-photo-preview');
  const removeCheck = wikiForm.querySelector('[name="removePhoto"]');
  if (page.photo) {
    preview.src = page.photo;
    preview.style.display = 'block';
    removeCheck.parentElement.hidden = false;
  } else {
    preview.style.display = 'none';
    removeCheck.parentElement.hidden = true;
  }
  removeCheck.checked = false;
  wikiForm._keptPhoto = page.photo || '';
  wikiOfficeList.innerHTML = '';
  (page.offices || []).forEach(o => addWikiOfficeRow(o));
  wikiEducationList.innerHTML = '';
  (page.educations || []).forEach(e => addWikiEducationRow(e));
  wikiSectionList.innerHTML = '';
  (page.sections || []).forEach(s => addWikiSectionRow(s));
  const viewLink = document.getElementById('wiki-view-link');
  if (viewLink) viewLink.href = `/#wiki-${currentWikiSlug}`;
  wikiForm.hidden = false;
}

function selectWikiPage(slug) {
  currentWikiSlug = slug;
  if (!slug || !content.wikiPages?.[slug]) {
    wikiForm.hidden = true;
    return;
  }
  fillWikiPage(content.wikiPages[slug]);
}

if (wikiSlugSelect) {
  wikiSlugSelect.addEventListener('change', () => selectWikiPage(wikiSlugSelect.value));
}

if (createWikiBtn) {
  createWikiBtn.addEventListener('click', () => {
    const slug = newWikiSlug.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 80);
    if (!slug) return;
    if (!content.wikiPages) content.wikiPages = {};
    if (content.wikiPages[slug]) { wikiSlugSelect.value = slug; selectWikiPage(slug); return; }
    content.wikiPages[slug] = { name: '', lead: '', offices: [], sections: [] };
    populateWikiSelect(content.wikiPages);
    wikiSlugSelect.value = slug;
    selectWikiPage(slug);
    newWikiSlug.value = '';
  });
}

if (deleteWikiBtn) {
  deleteWikiBtn.addEventListener('click', async () => {
    if (!currentWikiSlug) return;
    if (!confirm(`Delete wiki page "${currentWikiSlug}"? This cannot be undone.`)) return;
    try {
      content = await send('DELETE', `/api/admin/wiki/${currentWikiSlug}`);
      currentWikiSlug = '';
      populateWikiSelect(content.wikiPages || {});
      wikiForm.hidden = true;
    } catch (err) { alert(err.message); }
  });
}

if (document.getElementById('add-wiki-office')) {
  document.getElementById('add-wiki-office').addEventListener('click', () => addWikiOfficeRow());
}

if (document.getElementById('add-wiki-education')) {
  document.getElementById('add-wiki-education').addEventListener('click', () => addWikiEducationRow());
}

if (document.getElementById('add-wiki-section')) {
  document.getElementById('add-wiki-section').addEventListener('click', () => addWikiSectionRow());
}

if (wikiForm) {
  wikiForm.querySelector('[name="photo"]').addEventListener('change', function() {
    if (this.files[0]) {
      const preview = wikiForm.querySelector('.wiki-photo-preview');
      preview.src = URL.createObjectURL(this.files[0]);
      preview.style.display = 'block';
    }
  });

  wikiForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!currentWikiSlug) { setStatus(wikiForm, 'select a page first', true); return; }
    const data = new FormData();
    data.append('name', wikiForm.name.value);
    data.append('lead', wikiForm.lead.value);
    data.append('highlightWords', wikiForm.highlightWords.value);
    data.append('photoCaption', wikiForm.photoCaption.value);
    data.append('bornDate', wikiForm.bornDate.value);
    data.append('bornPlace', wikiForm.bornPlace.value);
    data.append('diedDate', wikiForm.diedDate.value);
    data.append('diedPlace', wikiForm.diedPlace.value);
    data.append('politicalParty', wikiForm.politicalParty.value);
    data.append('spouses', wikiForm.spouses.value);
    data.append('children', wikiForm.children.value);
    data.append('education', wikiForm.education.value);

    const educations = [...wikiEducationList.children].map(row => ({
      school: row.querySelector('[data-key="school"]')?.value || '',
      degree: row.querySelector('[data-key="degree"]')?.value || '',
    }));
    data.append('educations', JSON.stringify(educations));

    if (wikiForm.querySelector('[name="photo"]').files[0]) {
      data.append('photo', wikiForm.querySelector('[name="photo"]').files[0]);
    } else if (!wikiForm.querySelector('[name="removePhoto"]').checked) {
      data.append('keptPhoto', wikiForm._keptPhoto || '');
    } else {
      data.append('removePhoto', 'true');
    }

    const offices = [...wikiOfficeList.children].map(row => ({
      title: row.querySelector('[data-key="title"]')?.value || '',
      subtitle: row.querySelector('[data-key="subtitle"]')?.value || '',
      dates: row.querySelector('[data-key="dates"]')?.value || '',
      fields: [...row.querySelectorAll('.wiki-office-fields > div')].map(f => ({
        label: f.querySelector('[data-key="label"]')?.value || '',
        value: f.querySelector('[data-key="value"]')?.value || '',
      })),
    }));
    data.append('offices', JSON.stringify(offices));

    const sections = [...wikiSectionList.children].map(row => ({
      heading: row.querySelector('[data-key="heading"]')?.value || '',
      text: row.querySelector('[data-key="text"]')?.value || '',
    }));
    data.append('sections', JSON.stringify(sections));

    setStatus(wikiForm, 'saving...');
    try {
      content = await send('PUT', `/api/admin/wiki/${currentWikiSlug}`, data);
      fillWikiPage(content.wikiPages[currentWikiSlug] || {});
      populateWikiSelect(content.wikiPages || {});
      setStatus(wikiForm, 'saved ✓');
    } catch (err) {
      setStatus(wikiForm, err.message, true);
    }
  });
}

// ---------- Highlight Links ----------

const hlLinksList = document.getElementById('highlight-links-list');
const addHlLinkBtn = document.getElementById('add-highlight-link');
const saveHlLinksBtn = document.getElementById('save-highlight-links');
const hlLinksStatus = document.getElementById('highlight-links-status');

function addHighlightLinkRow(word = '', url = '') {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;align-items:center;';
  row.innerHTML = `
    <input type="text" data-key="word" maxlength="200" placeholder="highlight word (e.g. Democratic Party)" style="flex:1;padding:6px 8px;font-size:13px;border:1px solid #a2a9b1;border-radius:4px">
    <span style="color:#72777d">→</span>
    <input type="text" data-key="url" maxlength="500" placeholder="link (e.g. #wiki-democratic-party or https://...)" style="flex:1;padding:6px 8px;font-size:13px;border:1px solid #a2a9b1;border-radius:4px">
    <button type="button" class="button danger" style="font-size:11px;padding:4px 8px">×</button>`;
  row.querySelector('[data-key="word"]').value = word;
  row.querySelector('[data-key="url"]').value = url;
  row.querySelector('.button.danger').addEventListener('click', () => row.remove());
  hlLinksList.append(row);
}

function populateHighlightLinks(links) {
  if (!hlLinksList) return;
  hlLinksList.innerHTML = '';
  for (const [word, url] of Object.entries(links || {})) {
    addHighlightLinkRow(word, url);
  }
}

if (addHlLinkBtn) {
  addHlLinkBtn.addEventListener('click', () => addHighlightLinkRow());
}

if (saveHlLinksBtn) {
  saveHlLinksBtn.addEventListener('click', async () => {
    const links = {};
    hlLinksList.querySelectorAll(':scope > div').forEach(row => {
      const word = row.querySelector('[data-key="word"]').value.trim();
      const url = row.querySelector('[data-key="url"]').value.trim();
      if (word && url) links[word] = url;
    });
    hlLinksStatus.textContent = 'saving...';
    hlLinksStatus.style.color = '';
    try {
      content = await send('PUT', '/api/admin/highlight-links', links);
      populateHighlightLinks(content.highlightLinks || {});
      hlLinksStatus.textContent = 'saved ✓';
    } catch (err) {
      hlLinksStatus.textContent = err.message;
      hlLinksStatus.style.color = '#d33';
    }
  });
}

// ---------- Template Pages ----------

const tplSlugSelect = document.getElementById('tpl-slug-select');
const newTplSlug = document.getElementById('new-tpl-slug');
const createTplBtn = document.getElementById('create-tpl-btn');
const deleteTplBtn = document.getElementById('delete-tpl-btn');
const tplForm = document.getElementById('tpl-form');
const tplColBar = document.getElementById('tpl-col-bar');
const tplColEditor = document.getElementById('tpl-col-editor');
const tplRowList = document.getElementById('tpl-row-list');
const tplSectionList = document.getElementById('tpl-section-list');
const tplPreviewBody = document.getElementById('tpl-preview-body');
let currentTplSlug = '';
let tplColumns = [];
let tplEditingColIdx = -1;

function populateTplSelect(pages) {
  if (!tplSlugSelect) return;
  const slugs = Object.keys(pages || {}).sort();
  tplSlugSelect.innerHTML = '<option value="">— select a list page —</option>';
  slugs.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = pages[s].title || s;
    tplSlugSelect.append(opt);
  });
  if (currentTplSlug && pages[currentTplSlug]) {
    tplSlugSelect.value = currentTplSlug;
  }
}

const tplTypeColors = { text: '#3366cc', image: '#009933', 'color-bar': '#cc6600' };

function renderTplColBar() {
  if (!tplColBar) return;
  tplColBar.innerHTML = '';
  tplColumns.forEach((c, i) => {
    const chip = document.createElement('span');
    chip.className = 'tpl-col-chip' + (i === tplEditingColIdx ? ' tpl-col-chip-active' : '');
    const color = tplTypeColors[c.type] || '#3366cc';
    chip.style.cssText = `display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:4px;font-size:12px;cursor:pointer;border:1px solid ${color};color:${color};background:${color}18;`;
    if (i === tplEditingColIdx) chip.style.cssText += `font-weight:600;box-shadow:0 0 0 2px ${color}44;`;
    chip.textContent = (c.label || c.key || '(unnamed)') + (c.multi ? ' ⇅' : '');
    chip.addEventListener('click', () => openTplColEditor(i));
    tplColBar.append(chip);
  });
}

function openTplColEditor(idx) {
  if (!tplColEditor) return;
  saveTplColEditor();
  tplEditingColIdx = idx;
  const c = tplColumns[idx];
  if (!c) { tplColEditor.hidden = true; tplEditingColIdx = -1; renderTplColBar(); return; }
  document.getElementById('tpl-ce-key').value = c.key || '';
  document.getElementById('tpl-ce-label').value = c.label || '';
  document.getElementById('tpl-ce-type').value = c.type || 'text';
  document.getElementById('tpl-ce-width').value = c.width || '';
  document.getElementById('tpl-ce-height').value = c.height || '';
  document.getElementById('tpl-ce-multi').checked = !!c.multi;
  document.getElementById('tpl-ce-noHighlight').checked = !!c.noHighlight;
  document.getElementById('tpl-col-editor-title').textContent = `column ${idx + 1}: ${c.key || '(unnamed)'}`;
  tplColEditor.hidden = false;
  renderTplColBar();
}

function saveTplColEditor() {
  if (tplEditingColIdx < 0 || !tplColumns[tplEditingColIdx]) return;
  const c = tplColumns[tplEditingColIdx];
  c.key = document.getElementById('tpl-ce-key').value.trim();
  c.label = document.getElementById('tpl-ce-label').value.trim();
  c.type = document.getElementById('tpl-ce-type').value;
  c.width = document.getElementById('tpl-ce-width').value.trim();
  c.height = document.getElementById('tpl-ce-height').value.trim();
  c.multi = document.getElementById('tpl-ce-multi').checked;
  c.noHighlight = document.getElementById('tpl-ce-noHighlight').checked;
}

function closeTplColEditor() {
  saveTplColEditor();
  tplEditingColIdx = -1;
  if (tplColEditor) tplColEditor.hidden = true;
  renderTplColBar();
  rebuildTplRows();
  updateTplPreview();
}

function getTplColumns() {
  saveTplColEditor();
  return tplColumns.filter(c => c.key);
}

function getFirstTextVal(rowEl, columns) {
  for (const c of columns) {
    if (c.type === 'text' && c.key) {
      const input = rowEl.querySelector(`[data-col="${c.key}"]`);
      if (input?.value) return input.value.split('(')[0].trim().substring(0, 30);
    }
  }
  return '';
}

function addTplRowCard(rowData = {}, expanded = false) {
  if (!tplRowList) return;
  const idx = tplRowList.children.length;
  const cols = getTplColumns();
  const card = document.createElement('div');
  card.className = 'tpl-row-card';

  const firstText = (() => {
    for (const c of cols) {
      if (c.type === 'text' && c.key && rowData[c.key]) return rowData[c.key].split('(')[0].trim().substring(0, 30);
    }
    return '';
  })();

  const header = document.createElement('div');
  header.className = 'tpl-row-header';
  header.innerHTML = `<span class="tpl-row-toggle">▶</span> <span class="tpl-row-title">Row ${idx + 1}${firstText ? ' — ' + firstText : ''}</span>`;
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'button danger';
  removeBtn.style.cssText = 'font-size:11px;padding:2px 8px;margin-left:auto;';
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', e => { e.stopPropagation(); card.remove(); renumberTplRows(); updateTplPreview(); });
  header.append(removeBtn);

  const body = document.createElement('div');
  body.className = 'tpl-row-body';
  body.hidden = !expanded;

  cols.forEach(c => {
    if (c.type === 'image') {
      const field = document.createElement('div');
      field.className = 'tpl-row-field';
      const val = rowData[c.key] || '';
      field.innerHTML = `<label class="field"><span>${c.label || c.key}</span>
        <div style="display:flex;align-items:center;gap:8px">
          <img src="${val}" alt="" class="tpl-row-thumb" style="${val ? '' : 'display:none'}">
          <input type="file" data-col="${c.key}" accept="image/*" style="font-size:12px">
          <input type="hidden" data-col-kept="${c.key}" value="${val}">
        </div></label>`;
      const fileInput = field.querySelector(`[data-col="${c.key}"]`);
      fileInput.addEventListener('change', function() {
        if (this.files[0]) {
          const thumb = field.querySelector('.tpl-row-thumb');
          thumb.src = URL.createObjectURL(this.files[0]);
          thumb.style.display = '';
        }
      });
      body.append(field);
    } else if (c.type === 'color-bar') {
      const field = document.createElement('div');
      field.className = 'tpl-row-field';
      const val = rowData[c.key] || '#3333FF';
      field.innerHTML = `<label class="field"><span>${c.label || c.key}</span>
        <div style="display:flex;align-items:center;gap:8px">
          <input type="color" data-col="${c.key}" value="${val}" style="width:40px;height:28px;padding:0;border:1px solid #a2a9b1;border-radius:4px;cursor:pointer">
          <span class="tpl-color-hex" style="font-size:12px;color:#666">${val}</span>
        </div></label>`;
      field.querySelector(`[data-col="${c.key}"]`).addEventListener('input', function() {
        field.querySelector('.tpl-color-hex').textContent = this.value;
        updateTplPreview();
      });
      body.append(field);
    } else {
      const field = document.createElement('div');
      field.className = 'tpl-row-field';
      field.innerHTML = `<label class="field"><span>${c.label || c.key}</span><input type="text" data-col="${c.key}" maxlength="2000"></label>`;
      const input = field.querySelector(`[data-col="${c.key}"]`);
      input.value = rowData[c.key] || '';
      input.addEventListener('input', () => {
        const title = card.querySelector('.tpl-row-title');
        const ft = getFirstTextVal(card, cols);
        const ri = [...tplRowList.children].indexOf(card);
        title.textContent = `Row ${ri + 1}${ft ? ' — ' + ft : ''}`;
        updateTplPreview();
      });
      body.append(field);
    }
  });

  header.addEventListener('click', () => {
    const wasHidden = body.hidden;
    body.hidden = !wasHidden;
    header.querySelector('.tpl-row-toggle').textContent = wasHidden ? '▼' : '▶';
  });
  if (expanded) header.querySelector('.tpl-row-toggle').textContent = '▼';

  card.append(header, body);
  tplRowList.append(card);
}

function renumberTplRows() {
  if (!tplRowList) return;
  const cols = getTplColumns();
  [...tplRowList.children].forEach((card, i) => {
    const title = card.querySelector('.tpl-row-title');
    if (!title) return;
    const ft = getFirstTextVal(card, cols);
    title.textContent = `Row ${i + 1}${ft ? ' — ' + ft : ''}`;
  });
}

function rebuildTplRows() {
  if (!tplRowList) return;
  const cols = getTplColumns();
  const rowsData = extractTplRowData(cols);
  tplRowList.innerHTML = '';
  rowsData.forEach(r => addTplRowCard(r));
}

function extractTplRowData(columns) {
  if (!tplRowList) return [];
  return [...tplRowList.children].map(card => {
    const r = {};
    columns.forEach(c => {
      if (c.type === 'image') {
        const kept = card.querySelector(`[data-col-kept="${c.key}"]`);
        r[c.key] = kept?.value || '';
        const fileInput = card.querySelector(`[data-col="${c.key}"]`);
        if (fileInput?.files?.[0]) { r._file = r._file || {}; r._file[c.key] = fileInput.files[0]; }
      } else {
        const input = card.querySelector(`[data-col="${c.key}"]`);
        r[c.key] = input?.value || '';
      }
    });
    return r;
  });
}

function updateTplPreview() {
  if (!tplPreviewBody) return;
  const cols = getTplColumns();
  const rows = extractTplRowData(cols);
  if (!cols.length || !rows.length) { tplPreviewBody.innerHTML = '<div style="padding:12px;color:#999;font-size:12px;text-align:center">add columns and rows to see preview</div>'; return; }
  const esc = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const barMap = {};
  const barSameKey = new Set();
  cols.forEach((c, i) => { if (c.type === 'color-bar' && cols[i + 1]) { barMap[cols[i + 1].key] = c.key; if (c.key === cols[i + 1].key) barSameKey.add(c.key); } });
  const isNameCol = k => { const lk = (k || '').toLowerCase(); return lk.includes('name') || lk.includes('president'); };
  const isTermCol = k => (k || '').toLowerCase().includes('term');
  let html = '<table style="width:100%;border-collapse:collapse;font-size:11px;font-family:sans-serif;color:#202122"><thead><tr style="background:#eaecf0">';
  cols.forEach(c => {
    if (c.type === 'color-bar') return;
    const w = c.width ? ` style="width:${esc(c.width)}"` : '';
    html += `<th style="padding:4px 6px;border:1px solid #a2a9b1;font-size:10px;font-weight:700"${w}>${esc(c.label || c.key)}</th>`;
  });
  html += '</tr></thead><tbody>';
  rows.forEach(r => {
    const multiCols = cols.filter(c => c.multi);
    const maxMulti = Math.max(1, ...multiCols.map(c => { const v = r[c.key] || ''; return v.includes(';') ? v.split(';').length : 1; }));
    for (let sub = 0; sub < maxMulti; sub++) {
      html += '<tr>';
      cols.forEach(c => {
        if (c.type === 'color-bar') return;
        const val = r[c.key] || '';
        const parts = val.includes(';') ? val.split(';').map(s => s.trim()) : [val];
        const barKey = barMap[c.key];
        const barColor = barKey ? (r[barKey] || '') : '';
        const barStyle = barColor ? `border-left:4px solid ${esc(barColor)};` : '';
        if (!c.multi) {
          if (sub > 0) return;
          const rs = maxMulti > 1 ? ` rowspan="${maxMulti}"` : '';
          if (c.type === 'image') {
            html += `<td style="padding:3px;border:1px solid #a2a9b1;text-align:center"${rs}>${val ? `<div style="width:28px;height:34px;background:#ddd;border-radius:2px;display:inline-block"></div>` : ''}</td>`;
          } else if (barSameKey.has(c.key)) {
            html += `<td style="padding:3px 6px;border:1px solid #a2a9b1;font-size:10px;${barStyle}"${rs}></td>`;
          } else if (isNameCol(c.key)) {
            const m = val.match(/^(.+?)\s*\((.+)\)$/);
            if (m) html += `<td style="padding:3px 6px;border:1px solid #a2a9b1;${barStyle}"${rs}><span style="color:#0645ad;font-weight:700;font-size:11px">${esc(m[1])}</span><br><span style="font-size:10px;color:#555">(${esc(m[2])})</span></td>`;
            else html += `<td style="padding:3px 6px;border:1px solid #a2a9b1;${barStyle}"${rs}><span style="color:#0645ad;font-weight:700;font-size:11px">${esc(val)}</span></td>`;
          } else if (isTermCol(c.key)) {
            const tp = val.split(/\s*[-–]\s*/);
            if (tp.length === 2) html += `<td style="padding:3px 6px;border:1px solid #a2a9b1;text-align:center;font-size:10px;${barStyle}"${rs}>${esc(tp[0])}<br>–<br>${esc(tp[1])}</td>`;
            else html += `<td style="padding:3px 6px;border:1px solid #a2a9b1;font-size:10px;${barStyle}"${rs}>${esc(val)}</td>`;
          } else {
            html += `<td style="padding:3px 6px;border:1px solid #a2a9b1;font-size:10px;${barStyle}"${rs}>${esc(val)}</td>`;
          }
        } else {
          const cv = parts[sub] || '';
          if (isNameCol(c.key)) {
            const m = cv.match(/^(.+?)\s*\((.+)\)$/);
            if (m) html += `<td style="padding:3px 6px;border:1px solid #a2a9b1;${barStyle}"><span style="color:#0645ad;font-weight:700;font-size:11px">${esc(m[1])}</span><br><span style="font-size:10px;color:#555">(${esc(m[2])})</span></td>`;
            else html += `<td style="padding:3px 6px;border:1px solid #a2a9b1;${barStyle}"><span style="color:#0645ad;font-weight:700;font-size:11px">${esc(cv)}</span></td>`;
          } else {
            html += `<td style="padding:3px 6px;border:1px solid #a2a9b1;font-size:10px;${barStyle}">${esc(cv)}</td>`;
          }
        }
      });
      html += '</tr>';
    }
  });
  html += '</tbody></table>';
  tplPreviewBody.innerHTML = html;
}

function addTplSectionRow(section = {}) {
  const row = document.createElement('div');
  row.style.cssText = 'border:1px solid #333;border-radius:6px;padding:12px;display:flex;flex-direction:column;gap:8px;margin-bottom:8px;';
  row.innerHTML = `
    <label class="field"><span>heading</span><input type="text" data-key="heading" maxlength="300"></label>
    <label class="field"><span>text</span><textarea data-key="text" rows="4" maxlength="50000"></textarea></label>
    <button type="button" class="button danger remove-tpl-section" style="align-self:flex-end;font-size:12px">remove section</button>`;
  row.querySelector('[data-key="heading"]').value = section.heading || '';
  row.querySelector('[data-key="text"]').value = section.text || '';
  row.querySelector('.remove-tpl-section').addEventListener('click', () => row.remove());
  tplSectionList.append(row);
}

function fillTplPage(page) {
  if (!tplForm) return;
  tplForm.title.value = page.title || '';
  tplForm.lead.value = page.lead || '';
  tplForm.highlightWords.value = page.highlightWords || '';
  tplForm.sidebarCaption.value = page.sidebarCaption || '';
  const preview = tplForm.querySelector('.tpl-sidebar-preview');
  const removeCheck = tplForm.querySelector('[name="removeSidebarImage"]');
  if (page.sidebarImage) {
    preview.src = page.sidebarImage;
    preview.style.display = 'block';
    removeCheck.parentElement.hidden = false;
  } else {
    preview.style.display = 'none';
    removeCheck.parentElement.hidden = true;
  }
  removeCheck.checked = false;
  tplForm._keptSidebarImage = page.sidebarImage || '';
  tplColumns = (page.columns || []).map(c => ({ ...c }));
  tplEditingColIdx = -1;
  if (tplColEditor) tplColEditor.hidden = true;
  renderTplColBar();
  tplRowList.innerHTML = '';
  (page.rows || []).forEach(r => addTplRowCard(r));
  tplSectionList.innerHTML = '';
  (page.sections || []).forEach(s => addTplSectionRow(s));
  const viewLink = document.getElementById('tpl-view-link');
  if (viewLink) viewLink.href = `/#tpl-${currentTplSlug}`;
  tplForm.hidden = false;
  updateTplPreview();
}

function selectTplPage(slug) {
  currentTplSlug = slug;
  if (!slug || !content.templatePages?.[slug]) {
    if (tplForm) tplForm.hidden = true;
    return;
  }
  fillTplPage(content.templatePages[slug]);
}

if (tplSlugSelect) {
  tplSlugSelect.addEventListener('change', () => selectTplPage(tplSlugSelect.value));
}

if (createTplBtn) {
  createTplBtn.addEventListener('click', () => {
    const slug = newTplSlug.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 80);
    if (!slug) return;
    if (!content.templatePages) content.templatePages = {};
    if (content.templatePages[slug]) { tplSlugSelect.value = slug; selectTplPage(slug); return; }
    content.templatePages[slug] = { title: '', lead: '', columns: [], rows: [], sections: [] };
    populateTplSelect(content.templatePages);
    tplSlugSelect.value = slug;
    selectTplPage(slug);
    newTplSlug.value = '';
  });
}

if (deleteTplBtn) {
  deleteTplBtn.addEventListener('click', async () => {
    if (!currentTplSlug) return;
    if (!confirm(`Delete list page "${currentTplSlug}"? This cannot be undone.`)) return;
    try {
      content = await send('DELETE', `/api/admin/template/${currentTplSlug}`);
      currentTplSlug = '';
      populateTplSelect(content.templatePages || {});
      if (tplForm) tplForm.hidden = true;
    } catch (err) { alert(err.message); }
  });
}

if (document.getElementById('add-tpl-column')) {
  document.getElementById('add-tpl-column').addEventListener('click', () => {
    tplColumns.push({ key: '', label: '', type: 'text', width: '', height: '' });
    openTplColEditor(tplColumns.length - 1);
  });
}

if (document.getElementById('tpl-col-editor-close')) {
  document.getElementById('tpl-col-editor-close').addEventListener('click', closeTplColEditor);
}

if (document.getElementById('tpl-col-remove')) {
  document.getElementById('tpl-col-remove').addEventListener('click', () => {
    if (tplEditingColIdx >= 0) {
      tplColumns.splice(tplEditingColIdx, 1);
      tplEditingColIdx = -1;
      if (tplColEditor) tplColEditor.hidden = true;
      renderTplColBar();
      rebuildTplRows();
      updateTplPreview();
    }
  });
}

if (document.getElementById('add-tpl-row')) {
  document.getElementById('add-tpl-row').addEventListener('click', () => {
    addTplRowCard({}, true);
    renumberTplRows();
    updateTplPreview();
  });
}

if (document.getElementById('add-tpl-section')) {
  document.getElementById('add-tpl-section').addEventListener('click', () => addTplSectionRow());
}

if (tplForm) {
  tplForm.querySelector('[name="sidebarImage"]').addEventListener('change', function() {
    if (this.files[0]) {
      const preview = tplForm.querySelector('.tpl-sidebar-preview');
      preview.src = URL.createObjectURL(this.files[0]);
      preview.style.display = 'block';
    }
  });

  tplForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!currentTplSlug) { setStatus(tplForm, 'select a page first', true); return; }
    const data = new FormData();
    data.append('title', tplForm.title.value);
    data.append('lead', tplForm.lead.value);
    data.append('highlightWords', tplForm.highlightWords.value);
    data.append('sidebarCaption', tplForm.sidebarCaption.value);

    if (tplForm.querySelector('[name="sidebarImage"]').files[0]) {
      data.append('sidebarImage', tplForm.querySelector('[name="sidebarImage"]').files[0]);
    } else if (!tplForm.querySelector('[name="removeSidebarImage"]').checked) {
      data.append('keptSidebarImage', tplForm._keptSidebarImage || '');
    } else {
      data.append('removeSidebarImage', 'true');
    }

    const columns = getTplColumns();
    data.append('columns', JSON.stringify(columns));

    const rows = [...tplRowList.children].map(card => {
      const r = {};
      columns.forEach(c => {
        if (c.type === 'image') {
          const fileInput = card.querySelector(`[data-col="${c.key}"]`);
          const keptInput = card.querySelector(`[data-col-kept="${c.key}"]`);
          if (fileInput?.files?.[0]) {
            data.append('rowImage', fileInput.files[0], fileInput.files[0].name);
            r[c.key] = fileInput.files[0].name;
          } else {
            r[c.key] = keptInput?.value || '';
          }
        } else {
          const input = card.querySelector(`[data-col="${c.key}"]`);
          r[c.key] = input?.value || '';
        }
      });
      return r;
    });
    data.append('rows', JSON.stringify(rows));

    const sections = [...tplSectionList.children].map(row => ({
      heading: row.querySelector('[data-key="heading"]')?.value || '',
      text: row.querySelector('[data-key="text"]')?.value || '',
    }));
    data.append('sections', JSON.stringify(sections));

    setStatus(tplForm, 'saving...');
    try {
      content = await send('PUT', `/api/admin/template/${currentTplSlug}`, data);
      fillTplPage(content.templatePages[currentTplSlug] || {});
      populateTplSelect(content.templatePages || {});
      setStatus(tplForm, 'saved ✓');
    } catch (err) {
      setStatus(tplForm, err.message, true);
    }
  });
}

// ---------- fc/fifa stats ----------

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';

function statInput(field) {
  if (field.type === 'choice') {
    const select = document.createElement('select');
    select.name = field.key;
    field.options.forEach(option => select.add(new Option(option, option)));
    return select;
  }
  const input = document.createElement('input');
  input.name = field.key;
  if (field.type === 'bool') {
    input.type = 'checkbox';
    return input;
  }
  if (field.type === 'text') {
    input.type = 'text';
    input.maxLength = 120;
    if (field.placeholder) input.placeholder = field.placeholder;
    return input;
  }
  input.type = 'number';
  input.min = 0;
  input.max = { int: 100000, rating: 10, pct: 100 }[field.type];
  input.step = field.type === 'int' ? 1 : 0.1;
  input.inputMode = field.type === 'int' ? 'numeric' : 'decimal';
  return input;
}

// One line describing a saved row, e.g. "FC25 · ch08 · 30 mp · 12 goals".
function rowSummary(table, row) {
  const schema = FC_SCHEMA[table];
  const parts = schema.fields
    .filter(f => ['text', 'choice'].includes(f.type) && f.key !== 'position' && row[f.key])
    .map(f => row[f.key]);
  schema.fields
    .filter(f => !['text', 'choice', 'bool'].includes(f.type) && row[f.key] != null)
    .slice(0, 3)
    .forEach(f => parts.push(`${row[f.key]} ${f.short || f.label}`));
  if (row.me) parts.push('me');
  return parts.join(' · ');
}

function fcEditor(table) {
  const schema = FC_SCHEMA[table];
  const card = document.createElement('form');
  card.className = 'admin-card fc-editor';
  card.innerHTML = `
    <h2></h2>
    <div class="fc-entry">
      <div class="field fc-shot"><span>screenshot (optional)</span>
        <img class="fc-shot-preview" alt="Stats screenshot" hidden>
        <input type="file" name="screenshot" accept="${IMAGE_ACCEPT}">
        <label class="check" hidden><input type="checkbox" name="removeScreenshot"> remove screenshot</label>
      </div>
      <div class="fc-fields"></div>
    </div>
    <div class="button-row">
      <button type="submit" class="button">add row</button>
      <button type="button" class="button secondary fc-cancel" hidden>cancel</button>
      <span class="status" role="status"></span>
    </div>
    <ul class="fc-rows"></ul>`;
  card.querySelector('h2').textContent = schema.title;

  const fields = card.querySelector('.fc-fields');
  schema.fields.forEach(field => {
    const label = document.createElement('label');
    label.className = field.type === 'bool' ? 'check' : 'field';
    const input = statInput(field);
    if (field.type === 'bool') {
      label.append(input, ` ${field.label}`);
    } else {
      const caption = document.createElement('span');
      caption.textContent = field.label + (field.key === schema.required ? ' *' : '');
      label.append(caption, input);
    }
    fields.append(label);
  });

  const preview = card.querySelector('.fc-shot-preview');
  const shotInput = card.elements.screenshot;
  const removeShot = card.elements.removeScreenshot;
  const submit = card.querySelector('[type="submit"]');
  const cancel = card.querySelector('.fc-cancel');
  let editing = null;

  function showShot(src) {
    preview.hidden = !src;
    if (src) preview.src = src;
  }

  shotInput.addEventListener('change', () => {
    if (shotInput.files[0]) showShot(URL.createObjectURL(shotInput.files[0]));
    removeShot.checked = false;
  });

  function setValues(row) {
    schema.fields.forEach(field => {
      const input = card.elements[field.key];
      if (field.type === 'bool') input.checked = Boolean(row[field.key]);
      else input.value = row[field.key] ?? (field.type === 'choice' ? field.options[0] : '');
    });
  }

  // After adding a row, keep the game/season and screenshot so the next player
  // from the same screen is quick to enter; clear everything else.
  function resetForNext() {
    schema.fields.forEach(field => {
      const input = card.elements[field.key];
      if (field.type === 'choice' || field.key === 'season') return;
      if (field.type === 'bool') input.checked = false;
      else input.value = '';
    });
    shotInput.value = '';
  }

  function stopEditing() {
    editing = null;
    submit.textContent = 'add row';
    cancel.hidden = true;
    removeShot.parentElement.hidden = true;
    removeShot.checked = false;
    shotInput.value = '';
    showShot('');
    setValues({});
  }

  function startEditing(row) {
    editing = row;
    setValues(row);
    shotInput.value = '';
    showShot(row.screenshot);
    removeShot.parentElement.hidden = !row.screenshot;
    submit.textContent = 'save changes';
    cancel.hidden = false;
    setStatus(card, '');
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  cancel.addEventListener('click', () => {
    stopEditing();
    setStatus(card, '');
  });

  card.addEventListener('submit', async e => {
    e.preventDefault();
    const data = new FormData();
    schema.fields.forEach(field => {
      const input = card.elements[field.key];
      data.append(field.key, field.type === 'bool' ? input.checked : input.value);
    });
    if (shotInput.files[0]) data.append('screenshot', shotInput.files[0]);
    if (editing) data.append('removeScreenshot', removeShot.checked);

    setBusy(card, true);
    setStatus(card, 'saving…');
    try {
      const url = editing ? `/api/admin/fc/${table}/${editing.id}` : `/api/admin/fc/${table}`;
      content = await send(editing ? 'PUT' : 'POST', url, data, p => setStatus(card, `uploading… ${Math.round(p * 100)}%`));
      if (editing) {
        stopEditing();
        setStatus(card, 'saved ✓');
      } else {
        resetForNext();
        setStatus(card, 'added ✓');
      }
      renderRows();
      card.elements[schema.fields.find(f => !['choice', 'bool'].includes(f.type) && f.key !== 'season').key].focus();
    } catch (err) {
      setStatus(card, err.message, true);
    } finally {
      setBusy(card, false);
    }
  });

  function renderRows() {
    const rows = content.fc?.[table] || [];
    const list = card.querySelector('.fc-rows');
    if (!rows.length) {
      const empty = document.createElement('li');
      empty.className = 'empty-note';
      empty.textContent = 'nothing added yet';
      return list.replaceChildren(empty);
    }
    list.replaceChildren(...rows.map(row => {
      const li = document.createElement('li');
      li.className = 'fc-row';
      if (row.screenshot) {
        const thumb = document.createElement('img');
        thumb.className = 'art-thumb';
        thumb.src = row.screenshot;
        thumb.alt = '';
        thumb.loading = 'lazy';
        li.append(thumb);
      }
      const summary = document.createElement('span');
      summary.className = 'fc-row-summary';
      summary.textContent = rowSummary(table, row);
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'button secondary';
      editButton.textContent = 'edit';
      editButton.addEventListener('click', () => startEditing(row));
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'button danger';
      deleteButton.textContent = 'delete';
      deleteButton.addEventListener('click', async () => {
        if (!confirm(`Delete “${rowSummary(table, row)}”? This can’t be undone.`)) return;
        setBusy(card, true);
        try {
          content = await send('DELETE', `/api/admin/fc/${table}/${row.id}`);
          if (editing?.id === row.id) stopEditing();
          renderRows();
          setStatus(card, 'deleted');
        } catch (err) {
          setStatus(card, err.message, true);
        } finally {
          setBusy(card, false);
        }
      });
      li.append(summary, editButton, deleteButton);
      return li;
    }));
  }

  setValues({});
  card.renderRows = renderRows;
  return card;
}

const fcEditors = Object.keys(FC_SCHEMA).map(fcEditor);
document.querySelector('.fc-admin').append(...fcEditors);
const renderFcAdmin = () => fcEditors.forEach(card => card.renderRows());

// ---------- Contact ----------

const contactForm = document.getElementById('contact-form');

function fillContact(contact) {
  contactForm.paragraph.value = contact.paragraph;
  contactForm.email.value = contact.email;
  fillLinks(contactForm.querySelector('.link-editor'), contact.socials);
}

contactForm.addEventListener('submit', async e => {
  e.preventDefault();
  setBusy(contactForm, true);
  setStatus(contactForm, 'saving…');
  try {
    content = await send('PUT', '/api/admin/contact', {
      paragraph: contactForm.paragraph.value,
      email: contactForm.email.value,
      socials: readLinks(contactForm.querySelector('.link-editor')),
    });
    fillContact(content.contact);
    setStatus(contactForm, 'saved ✓');
  } catch (err) {
    setStatus(contactForm, err.message, true);
  } finally {
    setBusy(contactForm, false);
  }
});

// ---------- Beats ----------

const uploadForm = document.getElementById('beat-upload');
wireSongEditor(uploadForm);
wireProducerList(uploadForm);

// Reads the audio in the browser to get the bar heights for the waveform and its length.
async function analyzeAudio(file, bars = 240) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return { peaks: [], duration: null };
  const ctx = new AudioCtx();
  try {
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    const block = Math.floor(buffer.length / bars);
    const step = Math.max(1, Math.floor(block / 400));
    const peaks = [];
    for (let i = 0; i < bars; i++) {
      let max = 0;
      for (let j = i * block; j < (i + 1) * block; j += step) {
        for (const data of channels) max = Math.max(max, Math.abs(data[j]));
      }
      peaks.push(max);
    }
    const top = Math.max(...peaks, 0.0001);
    return { peaks: peaks.map(p => Math.round((p / top) * 1000) / 1000), duration: buffer.duration };
  } catch {
    return { peaks: [], duration: null };
  } finally {
    ctx.close();
  }
}

uploadForm.audio.addEventListener('change', () => {
  const file = uploadForm.audio.files[0];
  if (file && !uploadForm.title.value) uploadForm.title.value = file.name.replace(/\.[^.]+$/, '');
});

uploadForm.addEventListener('submit', async e => {
  e.preventDefault();
  const audio = uploadForm.audio.files[0];
  if (!audio) return;

  setBusy(uploadForm, true);
  setStatus(uploadForm, 'reading audio…');
  try {
    const { peaks, duration } = await analyzeAudio(audio);
    const data = new FormData();
    data.append('title', uploadForm.title.value);
    data.append('producers', JSON.stringify(readProducers(uploadForm)));
    data.append('bpm', uploadForm.bpm.value);
    data.append('key', uploadForm.key.value);
    appendSongs(data, uploadForm.querySelector('.song-editor'));
    data.append('downloadable', uploadForm.downloadable.checked);
    data.append('peaks', JSON.stringify(peaks));
    data.append('duration', duration);
    data.append('audio', audio);
    if (uploadForm.cover.files[0]) data.append('cover', uploadForm.cover.files[0]);

    content = await send('POST', '/api/admin/beats', data, p => setStatus(uploadForm, `uploading… ${Math.round(p * 100)}%`));
    renderBeats(content.beats);
    uploadForm.reset();
    uploadForm.querySelector('.song-editor').replaceChildren();
    uploadForm.querySelector('.producer-list').replaceChildren();
    addProducerRow(uploadForm.querySelector('.producer-list'));
    uploadForm.downloadable.checked = true;
    setStatus(uploadForm, peaks.length ? 'uploaded ✓' : 'uploaded ✓ (couldn’t read this file for a waveform, so it shows flat bars)');
  } catch (err) {
    setStatus(uploadForm, err.message, true);
  } finally {
    setBusy(uploadForm, false);
  }
});

function beatEditor(beat, index, total) {
  const form = document.getElementById('admin-beat-template').content.firstElementChild.cloneNode(true);
  const cover = form.querySelector('.beat-cover');
  if (beat.cover) cover.querySelector('img').src = beat.cover;
  else cover.classList.add('no-cover');
  form.querySelector('.remove-cover').hidden = !beat.cover;

  form.title.value = beat.title;
  wireProducerList(form, beat.producers || []);
  form.bpm.value = beat.bpm ?? '';
  form.key.value = beat.key;
  wireSongEditor(form, beat.songs || []);
  form.downloadable.checked = beat.downloadable;
  form.querySelector('audio').src = beat.audio;
  form.querySelector('.move-up').disabled = index === 0;
  form.querySelector('.move-down').disabled = index === total - 1;

  async function run(action, label) {
    setBusy(form, true);
    setStatus(form, label);
    try {
      content = await action();
      renderBeats(content.beats);
    } catch (err) {
      setStatus(form, err.message, true);
      setBusy(form, false);
    }
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const data = new FormData();
    data.append('title', form.title.value);
    data.append('producers', JSON.stringify(readProducers(form)));
    data.append('bpm', form.bpm.value);
    data.append('key', form.key.value);
    appendSongs(data, form.querySelector('.song-editor'));
    data.append('downloadable', form.downloadable.checked);
    data.append('removeCover', form.removeCover.checked);
    if (form.cover.files[0]) data.append('cover', form.cover.files[0]);
    run(() => send('PUT', `/api/admin/beats/${beat.id}`, data), 'saving…');
  });

  form.querySelector('.move-up').addEventListener('click', () =>
    run(() => send('POST', `/api/admin/beats/${beat.id}/move`, { direction: 'up' }), 'moving…'));
  form.querySelector('.move-down').addEventListener('click', () =>
    run(() => send('POST', `/api/admin/beats/${beat.id}/move`, { direction: 'down' }), 'moving…'));
  form.querySelector('.delete').addEventListener('click', () => {
    if (!confirm(`Delete “${beat.title}”? This can’t be undone.`)) return;
    run(() => send('DELETE', `/api/admin/beats/${beat.id}`), 'deleting…');
  });

  return form;
}

function renderBeats(beats) {
  document.querySelector('.admin-beat-list')
    .replaceChildren(...beats.map((beat, i) => beatEditor(beat, i, beats.length)));
  document.querySelector('#panel-beats .empty-note').hidden = beats.length > 0;
  renderProducers();
}

// ---------- Producer pictures ----------

const producerCard = document.getElementById('producer-pictures');

function producerRow(key, name) {
  const row = document.createElement('div');
  row.className = 'producer-row';
  const picture = content.producers?.[key];

  const thumb = document.createElement('button');
  thumb.type = 'button';
  thumb.className = 'song-thumb producer-thumb' + (picture ? '' : ' empty');
  thumb.setAttribute('aria-label', `Upload picture for ${name}`);
  if (picture) {
    const img = document.createElement('img');
    img.src = picture;
    img.alt = '';
    thumb.append(img);
  }

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/jpeg,image/png,image/gif,image/webp';
  fileInput.hidden = true;

  const label = document.createElement('span');
  label.className = 'producer-name';
  label.textContent = name;

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'button secondary';
  remove.textContent = 'remove';
  remove.hidden = !picture;

  const status = document.createElement('span');
  status.className = 'status';
  status.setAttribute('role', 'status');

  async function save(data, message) {
    row.querySelectorAll('button').forEach(b => b.disabled = true);
    status.textContent = message;
    status.classList.remove('error');
    try {
      content = await send('PUT', `/api/admin/producers/${encodeURIComponent(key)}`, data,
        p => status.textContent = `uploading… ${Math.round(p * 100)}%`);
      renderProducers();
    } catch (err) {
      status.textContent = err.message;
      status.classList.add('error');
      row.querySelectorAll('button').forEach(b => b.disabled = false);
    }
  }

  thumb.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (!fileInput.files[0]) return;
    const data = new FormData();
    data.append('image', fileInput.files[0]);
    save(data, 'saving…');
  });
  remove.addEventListener('click', () => {
    const data = new FormData();
    data.append('remove', 'true');
    save(data, 'removing…');
  });

  row.append(thumb, fileInput, label, remove, status);
  return row;
}

// One row per producer on the beats, matched the same way as the public pills.
function renderProducers() {
  const names = new Map();
  content.beats.flatMap(beat => beat.producers || []).forEach(name => {
    if (!names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
  });
  const sorted = [...names].sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: 'base' }));
  producerCard.querySelector('.producer-editor').replaceChildren(...sorted.map(([key, name]) => producerRow(key, name)));
  producerCard.hidden = names.size === 0;
}

// ---------- Load ----------

fetch('/api/content', { cache: 'no-store' })
  .then(res => res.json())
  .then(data => {
    content = data;
    fillHome(content.home);
    fillContact(content.contact);
    renderBeats(content.beats);
    renderArt(content.art || []);
    renderClipsAdmin(content.clips || []);
    populateElectionSelect(content.elections || {});
    populateCensusSelect(content.censusData || {});
    populateWikiSelect(content.wikiPages || {});
    populateTplSelect(content.templatePages || {});
    populateHighlightLinks(content.highlightLinks || {});
    renderFcAdmin();
  });
