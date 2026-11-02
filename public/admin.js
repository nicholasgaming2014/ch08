// Admin panel: edit home and contact, upload and manage beats.
const HEADERS = { 'X-Requested-With': 'ch08-admin' };
let content = null;

// ---------- Tabs ----------

const TABS = ['home', 'beats', 'contact'];
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

  row.append(...fields, remove);
  editor.append(row);
}

function readSongs(editor) {
  return [...editor.querySelectorAll('.song-row')]
    .map(row => Object.fromEntries([...row.querySelectorAll('input')].map(i => [i.dataset.key, i.value.trim()])))
    .filter(song => song.title || song.artist || song.url);
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

// Reads the audio in the browser to get the bar heights for the waveform.
async function computePeaks(file, bars = 240) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return [];
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
    return peaks.map(p => Math.round((p / top) * 1000) / 1000);
  } catch {
    return [];
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
    const peaks = await computePeaks(audio);
    const data = new FormData();
    data.append('title', uploadForm.title.value);
    data.append('producer', uploadForm.producer.value);
    data.append('bpm', uploadForm.bpm.value);
    data.append('key', uploadForm.key.value);
    data.append('songs', JSON.stringify(readSongs(uploadForm.querySelector('.song-editor'))));
    data.append('downloadable', uploadForm.downloadable.checked);
    data.append('peaks', JSON.stringify(peaks));
    data.append('audio', audio);
    if (uploadForm.cover.files[0]) data.append('cover', uploadForm.cover.files[0]);

    content = await send('POST', '/api/admin/beats', data, p => setStatus(uploadForm, `uploading… ${Math.round(p * 100)}%`));
    renderBeats(content.beats);
    uploadForm.reset();
    uploadForm.querySelector('.song-editor').replaceChildren();
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
  form.producer.value = beat.producer || '';
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
    data.append('producer', form.producer.value);
    data.append('bpm', form.bpm.value);
    data.append('key', form.key.value);
    data.append('songs', JSON.stringify(readSongs(form.querySelector('.song-editor'))));
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
}

// ---------- Load ----------

fetch('/api/content', { cache: 'no-store' })
  .then(res => res.json())
  .then(data => {
    content = data;
    fillHome(content.home);
    fillContact(content.contact);
    renderBeats(content.beats);
  });
