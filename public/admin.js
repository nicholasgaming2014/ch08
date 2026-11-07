// Admin panel: edit home and contact, upload and manage beats.
const HEADERS = { 'X-Requested-With': 'ch08-admin' };
let content = null;

// ---------- Tabs ----------

const TABS = ['home', 'beats', 'art', 'fc', 'manager', 'contact'];
const tabLinks = document.querySelectorAll('.admin-tabs .menu-link');

function showTab() {
  const id = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
  TABS.forEach(tab => document.getElementById('panel-' + tab).hidden = tab !== id);
  tabLinks.forEach(l => l.classList.toggle('active', l.hash === '#' + id));
}

window.addEventListener('hashchange', showTab);
showTab();

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
const homePreview = homeForm.querySelector('.image-preview');

function fillHome(home) {
  homeForm.headline.value = home.headline;
  homeForm.bigText.value = home.bigText;
  homeForm.paragraph.value = home.paragraph;
  homeForm.image.value = '';
  homeForm.removeImage.checked = false;
  homePreview.src = home.image || '';
  homePreview.hidden = !home.image;
  fillLinks(homeForm.querySelector('.link-editor'), home.links);
}

homeForm.image.addEventListener('change', () => {
  const file = homeForm.image.files[0];
  if (!file) return;
  homePreview.src = URL.createObjectURL(file);
  homePreview.hidden = false;
  homeForm.removeImage.checked = false;
});

homeForm.addEventListener('submit', async e => {
  e.preventDefault();
  const data = new FormData();
  data.append('headline', homeForm.headline.value);
  data.append('bigText', homeForm.bigText.value);
  data.append('paragraph', homeForm.paragraph.value);
  data.append('links', JSON.stringify(readLinks(homeForm.querySelector('.link-editor'))));
  data.append('removeImage', homeForm.removeImage.checked);
  if (homeForm.image.files[0]) data.append('image', homeForm.image.files[0]);

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

// ---------- Manager ----------

const mgrForm = document.getElementById('manager-player-form');
const mgrCancel = mgrForm.querySelector('.mgr-cancel');
let mgrEditing = null;

function mgrPlayerRow(player) {
  const row = document.createElement('div');
  row.className = 'fc-row';
  if (player.photo) {
    const thumb = document.createElement('img');
    thumb.className = 'art-thumb';
    thumb.src = player.photo;
    thumb.alt = '';
    thumb.loading = 'lazy';
    row.append(thumb);
  }
  const summary = document.createElement('span');
  summary.className = 'fc-row-summary';
  summary.textContent = `${player.name} — ${player.position} ${player.overall}`;
  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'button secondary';
  editBtn.textContent = 'edit';
  editBtn.addEventListener('click', () => mgrStartEdit(player));
  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'button danger';
  deleteBtn.textContent = 'delete';
  deleteBtn.addEventListener('click', async () => {
    if (!confirm(`Delete "${player.name}"?`)) return;
    setBusy(mgrForm, true);
    try {
      content = await send('DELETE', `/api/admin/manager/players/${player.id}`);
      renderMgrPlayers();
      setStatus(mgrForm, 'deleted');
    } catch (err) { setStatus(mgrForm, err.message, true); }
    finally { setBusy(mgrForm, false); }
  });
  row.append(summary, editBtn, deleteBtn);
  return row;
}

function renderMgrPlayers() {
  const players = content.manager?.players || [];
  const list = document.querySelector('.mgr-player-list');
  list.replaceChildren(...players.map(mgrPlayerRow));
  document.querySelector('.mgr-empty').hidden = players.length > 0;
}

function renderMgrHistory() {
  const history = content.manager?.history || [];
  const list = document.querySelector('.mgr-history-list');
  list.replaceChildren(...history.slice().reverse().map(m => {
    const row = document.createElement('div');
    row.className = 'fc-row';
    const summary = document.createElement('span');
    summary.className = 'fc-row-summary';
    const d = new Date(m.date);
    summary.textContent = `${m.homeTeam} ${m.homeScore} - ${m.awayScore} ${m.awayTeam}  (${d.toLocaleDateString()})`;
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'button danger';
    deleteBtn.textContent = 'delete';
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Delete this match result?')) return;
      try {
        content = await send('DELETE', `/api/admin/manager/history/${m.id}`);
        renderMgrHistory();
      } catch (err) { setStatus(mgrForm, err.message, true); }
    });
    row.append(summary, deleteBtn);
    return row;
  }));
  document.querySelector('.mgr-history-empty').hidden = history.length > 0;
}

function mgrStartEdit(player) {
  mgrEditing = player;
  mgrForm.name.value = player.name;
  mgrForm.position.value = player.position;
  mgrForm.overall.value = player.overall;
  mgrForm.pace.value = player.pace;
  mgrForm.shooting.value = player.shooting;
  mgrForm.passing.value = player.passing;
  mgrForm.dribbling.value = player.dribbling;
  mgrForm.defending.value = player.defending;
  mgrForm.physical.value = player.physical;
  mgrForm.querySelector('[type="submit"]').textContent = 'save changes';
  mgrCancel.hidden = false;
  mgrForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function mgrStopEdit() {
  mgrEditing = null;
  mgrForm.reset();
  mgrForm.querySelector('[type="submit"]').textContent = 'add player';
  mgrCancel.hidden = true;
}

mgrCancel.addEventListener('click', () => { mgrStopEdit(); setStatus(mgrForm, ''); });

mgrForm.addEventListener('submit', async e => {
  e.preventDefault();
  const data = new FormData();
  data.append('name', mgrForm.name.value);
  data.append('position', mgrForm.position.value);
  data.append('overall', mgrForm.overall.value);
  data.append('pace', mgrForm.pace.value);
  data.append('shooting', mgrForm.shooting.value);
  data.append('passing', mgrForm.passing.value);
  data.append('dribbling', mgrForm.dribbling.value);
  data.append('defending', mgrForm.defending.value);
  data.append('physical', mgrForm.physical.value);
  if (mgrForm.photo.files[0]) data.append('photo', mgrForm.photo.files[0]);

  setBusy(mgrForm, true);
  setStatus(mgrForm, 'saving…');
  try {
    const url = mgrEditing ? `/api/admin/manager/players/${mgrEditing.id}` : '/api/admin/manager/players';
    content = await send(mgrEditing ? 'PUT' : 'POST', url, data);
    if (mgrEditing) mgrStopEdit();
    else mgrForm.reset();
    renderMgrPlayers();
    setStatus(mgrForm, mgrEditing ? 'saved ✓' : 'added ✓');
  } catch (err) { setStatus(mgrForm, err.message, true); }
  finally { setBusy(mgrForm, false); }
});

// ---------- Load ----------

fetch('/api/content', { cache: 'no-store' })
  .then(res => res.json())
  .then(data => {
    content = data;
    fillHome(content.home);
    fillContact(content.contact);
    renderBeats(content.beats);
    renderArt(content.art || []);
    renderFcAdmin();
    renderMgrPlayers();
    renderMgrHistory();
  });
