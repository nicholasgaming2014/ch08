// Public site: page switching, content from /api/content, and the beat player.
const PAGES = ['home', 'beats', 'art', 'contact'];
const pages = document.querySelectorAll('.page');
const pageLinks = document.querySelectorAll('.menu-link[href^="/#"]');

function showPage() {
  const id = PAGES.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
  pages.forEach(p => p.hidden = p.id !== id);
  pageLinks.forEach(l => l.classList.toggle('active', l.hash === '#' + id));
  if (id === 'beats') requestAnimationFrame(() => players.forEach(p => p.draw()));
}

window.addEventListener('hashchange', showPage);
showPage();

function setText(el, value) {
  el.textContent = value || '';
  el.hidden = !value;
}

function renderLinks(container, links) {
  container.replaceChildren(...links.map(link => {
    const a = document.createElement('a');
    a.className = 'pill-link';
    a.href = link.url;
    a.textContent = link.label;
    if (!link.url.startsWith('mailto:')) {
      a.target = '_blank';
      a.rel = 'noopener';
    }
    return a;
  }));
  container.hidden = links.length === 0;
}

function renderHome(home) {
  const section = document.getElementById('home');
  setText(section.querySelector('.home-headline'), home.headline);
  setText(section.querySelector('.home-big'), home.bigText);
  setText(section.querySelector('.home-paragraph'), home.paragraph);
  const img = section.querySelector('.hero-gif');
  if (home.image) img.src = home.image;
  img.hidden = !home.image;
  renderLinks(section.querySelector('.link-list'), home.links);
}

// Logo and tile color for each social row, matched on the link's host.
// Logos are Simple Icons (CC0) in public/icons/brands.
const SOCIAL_BRANDS = [
  ['instagram', '#d6297a', host => host.endsWith('instagram.com')],
  ['youtube', '#ff0033', host => host.endsWith('youtube.com') || host === 'youtu.be'],
  ['soundcloud', '#ff5500', host => host.endsWith('soundcloud.com')],
  ['spotify', '#1db954', host => host.endsWith('spotify.com')],
  ['applemusic', '#fa2d48', host => host.endsWith('music.apple.com')],
  ['tiktok', '#000', host => host.endsWith('tiktok.com')],
  ['x', '#000', host => host.endsWith('x.com') || host.endsWith('twitter.com')],
  ['threads', '#000', host => host.endsWith('threads.net') || host.endsWith('threads.com')],
  ['facebook', '#0866ff', host => host.endsWith('facebook.com') || host === 'fb.com'],
  ['twitch', '#9146ff', host => host.endsWith('twitch.tv')],
  ['discord', '#5865f2', host => host.endsWith('discord.gg') || host.endsWith('discord.com')],
  ['bandcamp', '#408294', host => host.endsWith('bandcamp.com')],
  ['snapchat', '#fffc00', host => host.endsWith('snapchat.com')],
  ['github', '#24292f', host => host.endsWith('github.com')],
  ['patreon', '#000', host => host.endsWith('patreon.com')],
  ['linktree', '#43e660', host => host.endsWith('linktr.ee')],
];
// Logos drawn black on these light tiles; white everywhere else.
const DARK_GLYPH = new Set(['snapchat', 'linktree']);

const CHEVRON = '<svg class="row-chevron" viewBox="0 0 8 14" aria-hidden="true"><path d="M1 1l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function socialRow(link) {
  const isMail = link.url.startsWith('mailto:');
  const host = isMail ? link.url.slice(7) : new URL(link.url).hostname.replace(/^www\./, '');
  const row = document.createElement('a');
  row.className = 'panel-row';
  row.href = link.url;
  if (!isMail) {
    row.target = '_blank';
    row.rel = 'noopener';
  }

  const icon = document.createElement('span');
  icon.className = 'row-icon';
  icon.setAttribute('aria-hidden', 'true');
  const [brand, tile] = SOCIAL_BRANDS.find(([, , matches]) => matches(host)) || ['link', '#0a84ff'];
  icon.style.setProperty('--tile', tile);
  const logo = document.createElement('span');
  logo.className = 'row-logo';
  logo.style.setProperty('--logo', `url(/icons/brands/${brand}.svg)`);
  if (DARK_GLYPH.has(brand)) logo.style.background = '#000';
  icon.append(logo);

  const text = document.createElement('span');
  text.className = 'row-text';
  const title = document.createElement('span');
  title.className = 'row-title';
  title.textContent = link.label;
  const detail = document.createElement('span');
  detail.className = 'row-detail';
  detail.textContent = host;
  text.append(title, detail);

  row.append(icon, text);
  row.insertAdjacentHTML('beforeend', CHEVRON);
  return row;
}

function renderContact(contact) {
  const section = document.getElementById('contact');
  section.querySelector('.contact-paragraph').textContent = contact.paragraph;
  section.querySelector('.contact-intro').hidden = !contact.paragraph;

  section.querySelector('.contact-email').href = contact.email ? 'mailto:' + contact.email : '';
  section.querySelector('.contact-address').textContent = contact.email;
  section.querySelector('.contact-email-group').hidden = !contact.email;

  section.querySelector('.contact-socials').replaceChildren(...contact.socials.map(socialRow));
  section.querySelector('.contact-social-group').hidden = contact.socials.length === 0;
}

// Copies the email address and confirms in the row for a moment.
const copyRow = document.querySelector('.contact-copy');
let copyTimer = null;
// Older browsers and non-https pages lack the clipboard API, so fall back to a hidden field.
function copyWithField(value) {
  const field = document.createElement('textarea');
  field.value = value;
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;opacity:0';
  document.body.append(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  return copied;
}

copyRow.addEventListener('click', async () => {
  const status = copyRow.querySelector('.row-status');
  const address = document.querySelector('.contact-address').textContent;
  let copied = false;
  try {
    await navigator.clipboard.writeText(address);
    copied = true;
  } catch {
    copied = copyWithField(address);
  }
  status.textContent = copied ? 'copied' : 'couldn’t copy';
  status.classList.toggle('error', !copied);
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => { status.textContent = ''; }, 2000);
});

// ---------- Art ----------

const viewer = document.querySelector('.art-viewer');
let artPieces = [];
let viewing = 0;

function showPiece(index) {
  viewing = (index + artPieces.length) % artPieces.length;
  const piece = artPieces[viewing];
  const img = viewer.querySelector('img');
  img.src = piece.image;
  img.alt = piece.title || 'Artwork';
  setText(viewer.querySelector('figcaption'), piece.title);
  const single = artPieces.length < 2;
  viewer.querySelector('.viewer-prev').hidden = single;
  viewer.querySelector('.viewer-next').hidden = single;
}

function openViewer(index) {
  showPiece(index);
  viewer.showModal();
}

viewer.querySelector('.viewer-close').addEventListener('click', () => viewer.close());
viewer.querySelector('.viewer-prev').addEventListener('click', () => showPiece(viewing - 1));
viewer.querySelector('.viewer-next').addEventListener('click', () => showPiece(viewing + 1));
viewer.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') showPiece(viewing - 1);
  if (e.key === 'ArrowRight') showPiece(viewing + 1);
});
// Clicking the dark area around the picture closes it.
viewer.addEventListener('click', e => {
  if (e.target === viewer || e.target.classList.contains('viewer-figure')) viewer.close();
});

function renderArt(art) {
  artPieces = art;
  const section = document.getElementById('art');
  section.querySelector('.art-collage').replaceChildren(...art.map((piece, i) => {
    const figure = document.createElement('figure');
    figure.className = 'art-piece';
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', piece.title ? `View ${piece.title}` : 'View artwork');
    const img = document.createElement('img');
    img.src = piece.image;
    img.alt = piece.title || '';
    img.loading = 'lazy';
    // Known size reserves the space so the collage doesn't jump while images load.
    if (piece.width && piece.height) {
      img.width = piece.width;
      img.height = piece.height;
    }
    button.append(img);
    button.addEventListener('click', () => openViewer(i));
    figure.append(button);
    if (piece.title) {
      const caption = document.createElement('figcaption');
      caption.textContent = piece.title;
      figure.append(caption);
    }
    return figure;
  }));
  section.querySelector('.empty-note').hidden = art.length > 0;
}

// ---------- Beat player ----------

const players = [];

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fileExtension(url) {
  const match = url.match(/\.[a-z0-9]+$/i);
  return match ? match[0] : '';
}

// Names the link button after the service the song is on.
function serviceName(url) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  if (host.endsWith('spotify.com')) return 'spotify';
  if (host.endsWith('soundcloud.com') || host === 'on.soundcloud.com') return 'soundcloud';
  if (host.endsWith('music.apple.com')) return 'apple music';
  if (host.endsWith('youtube.com') || host === 'youtu.be') return 'youtube';
  return 'listen';
}

function renderSongs(container, songs) {
  container.querySelector('ul').replaceChildren(...songs.map(song => {
    const li = document.createElement('li');
    const cover = document.createElement('span');
    cover.className = 'song-cover';
    const art = song.cover || song.artwork;
    if (art) {
      const img = document.createElement('img');
      img.src = art;
      img.alt = '';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      cover.append(img);
    }
    li.append(cover);
    const name = document.createElement('span');
    name.className = 'song-name';
    name.textContent = song.title || song.artist;
    li.append(name);
    if (song.title && song.artist) {
      const artist = document.createElement('span');
      artist.className = 'song-artist';
      artist.textContent = song.artist;
      li.append(artist);
    }
    if (song.url) {
      const link = document.createElement('a');
      link.className = 'song-link';
      link.href = song.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = serviceName(song.url);
      li.append(link);
    }
    return li;
  }));
  container.hidden = songs.length === 0;
}

// "a", "a & b", "a, b & c"
function joinNames(names) {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`;
}

function createPlayer(beat) {
  const node = document.getElementById('beat-template').content.firstElementChild.cloneNode(true);
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.src = beat.audio;

  const cover = node.querySelector('.beat-cover');
  if (beat.cover) cover.querySelector('img').src = beat.cover;
  else cover.classList.add('no-cover');

  node.querySelector('.beat-title').textContent = beat.title;
  const producers = beat.producers || [];
  setText(node.querySelector('.beat-producer'), producers.length && `prod. ${joinNames(producers)}`);
  const meta = [beat.bpm && `${beat.bpm} bpm`, beat.key].filter(Boolean).join(' · ');
  setText(node.querySelector('.beat-meta'), meta);
  renderSongs(node.querySelector('.beat-songs'), beat.songs || []);

  const download = node.querySelector('.beat-download');
  if (beat.downloadable) {
    download.href = beat.audio;
    download.download = beat.title + fileExtension(beat.audio);
  } else {
    download.remove();
  }

  const button = node.querySelector('.play-button');
  const canvas = node.querySelector('.waveform');
  const current = node.querySelector('.time-current');
  const total = node.querySelector('.time-total');
  // Older uploads without peaks still get an even bar pattern to seek on.
  const peaks = beat.peaks?.length ? beat.peaks : Array(160).fill(0.35);
  let hover = null;
  let frame = null;

  function draw() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);

    const bar = 2;
    const gap = 1;
    const count = Math.max(1, Math.floor(width / (bar + gap)));
    const progress = audio.duration ? audio.currentTime / audio.duration : 0;
    const max = Math.max(...peaks, 0.01);

    for (let i = 0; i < count; i++) {
      const peak = peaks[Math.floor((i / count) * peaks.length)] / max;
      const h = Math.max(2, peak * height);
      const x = i * (bar + gap);
      const at = (i + 0.5) / count;
      ctx.fillStyle = at <= progress ? '#fff' : hover !== null && at <= hover ? '#999' : '#444';
      ctx.fillRect(x, (height - h) / 2, bar, h);
    }
  }

  function tick() {
    draw();
    current.textContent = formatTime(audio.currentTime);
    frame = audio.paused ? null : requestAnimationFrame(tick);
  }

  function seekFraction(event) {
    const rect = canvas.getBoundingClientRect();
    return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  }

  button.addEventListener('click', () => {
    if (audio.paused) {
      players.forEach(p => { if (p !== player) { p.pause(); p.restart(); } });
      audio.play();
    } else {
      audio.pause();
    }
  });

  canvas.addEventListener('pointermove', e => { hover = seekFraction(e); draw(); });
  canvas.addEventListener('pointerleave', () => { hover = null; draw(); });
  canvas.addEventListener('click', e => {
    const fraction = seekFraction(e);
    const seek = () => {
      audio.currentTime = fraction * audio.duration;
      if (audio.paused) button.click();
      tick();
    };
    if (audio.duration) seek();
    else audio.addEventListener('loadedmetadata', seek, { once: true });
  });

  audio.addEventListener('loadedmetadata', () => {
    total.textContent = formatTime(audio.duration);
    if (!beat.duration && view.sort.startsWith('length')) applyView();
  });
  audio.addEventListener('play', () => {
    node.classList.add('playing');
    button.setAttribute('aria-label', 'Pause');
    if (!frame) tick();
  });
  audio.addEventListener('pause', () => {
    node.classList.remove('playing');
    button.setAttribute('aria-label', 'Play');
    tick();
  });
  audio.addEventListener('ended', () => {
    audio.currentTime = 0;
    tick();
  });

  const player = {
    beat,
    node,
    draw,
    pause: () => audio.pause(),
    restart: () => { audio.currentTime = 0; tick(); },
    // Stored at upload; older beats fall back to the audio file's own length.
    duration: () => beat.duration || (Number.isFinite(audio.duration) ? audio.duration : null),
  };
  return player;
}

// ---------- Sorting and producer filter ----------

const view = { sort: 'newest', producers: new Set() };
let producerPictures = {};
const sortSelect = document.getElementById('beat-sort');
const producerPills = document.querySelector('.producer-pills');

const producerKey = name => (name || '').trim().toLowerCase();

// Missing values (no bpm, unknown length) always sort to the end.
function compareMissingLast(a, b, desc) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return desc ? b - a : a - b;
}

const SORTS = {
  newest: (a, b) => (b.beat.createdAt || '').localeCompare(a.beat.createdAt || ''),
  oldest: (a, b) => (a.beat.createdAt || '').localeCompare(b.beat.createdAt || ''),
  title: (a, b) => a.beat.title.localeCompare(b.beat.title, undefined, { sensitivity: 'base', numeric: true }),
  'title-desc': (a, b) => b.beat.title.localeCompare(a.beat.title, undefined, { sensitivity: 'base', numeric: true }),
  bpm: (a, b) => compareMissingLast(a.beat.bpm, b.beat.bpm, false),
  'bpm-desc': (a, b) => compareMissingLast(a.beat.bpm, b.beat.bpm, true),
  length: (a, b) => compareMissingLast(a.duration(), b.duration(), false),
  'length-desc': (a, b) => compareMissingLast(a.duration(), b.duration(), true),
};

function applyView() {
  const visible = players.filter(p => !view.producers.size || (p.beat.producers || []).some(name => view.producers.has(producerKey(name))));
  players.filter(p => !visible.includes(p)).forEach(p => p.pause());
  visible.sort(SORTS[view.sort] || SORTS.newest);
  document.querySelector('.beat-list').replaceChildren(...visible.map(p => p.node));
  visible.forEach(p => p.draw());

  const empty = document.querySelector('#beats .empty-note');
  empty.textContent = players.length ? 'no beats by these producers' : 'no beats yet';
  empty.hidden = visible.length > 0;

  producerPills.querySelectorAll('.filter-pill').forEach(pill => {
    const active = pill.dataset.producer ? view.producers.has(pill.dataset.producer) : view.producers.size === 0;
    pill.classList.toggle('active', active);
    pill.setAttribute('aria-pressed', active);
  });
}

function pill(label, producer = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'filter-pill';
  const picture = producer && producerPictures[producer];
  if (picture) {
    const img = document.createElement('img');
    img.src = picture;
    img.alt = '';
    button.append(img);
    button.classList.add('has-picture');
  }
  button.append(label);
  button.dataset.producer = producer;
  button.addEventListener('click', () => {
    if (!producer) view.producers.clear();
    else if (view.producers.has(producer)) view.producers.delete(producer);
    else view.producers.add(producer);
    applyView();
  });
  return button;
}

function renderProducerPills() {
  // One pill per producer, using the first spelling seen.
  const names = new Map();
  players.flatMap(p => p.beat.producers || []).forEach(name => {
    const key = producerKey(name);
    if (key && !names.has(key)) names.set(key, name.trim());
  });
  [...view.producers].forEach(key => names.has(key) || view.producers.delete(key));
  const sorted = [...names].sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: 'base' }));
  producerPills.replaceChildren(pill('all'), ...sorted.map(([key, name]) => pill(name, key)));
  producerPills.hidden = names.size === 0;
}

sortSelect.addEventListener('change', () => {
  view.sort = sortSelect.value;
  applyView();
});

function renderBeats(beats, pictures = {}) {
  producerPictures = pictures;
  players.forEach(p => p.pause());
  players.length = 0;
  beats.forEach(beat => players.push(createPlayer(beat)));
  document.querySelector('.beats-toolbar').hidden = beats.length < 2;
  renderProducerPills();
  applyView();
}

window.addEventListener('resize', () => players.forEach(p => p.draw()));

fetch('/api/content')
  .then(res => res.json())
  .then(content => {
    renderHome(content.home);
    renderContact(content.contact);
    renderArt(content.art || []);
    renderBeats(content.beats, content.producers);
  });
