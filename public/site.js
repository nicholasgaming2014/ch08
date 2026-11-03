// Public site: page switching, content from /api/content, and the beat player.
const PAGES = ['home', 'beats', 'ch08pedia', 'contact'];
const pages = document.querySelectorAll('.page');
const pageLinks = document.querySelectorAll('.menu-link[href^="/#"]');

function showPage() {
  const id = PAGES.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
  pages.forEach(p => p.hidden = p.id !== id);
  document.body.classList.toggle('on-pedia', id === 'ch08pedia');
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

function renderContact(contact) {
  const section = document.getElementById('contact');
  setText(section.querySelector('.contact-paragraph'), contact.paragraph);
  const email = section.querySelector('.contact-email');
  setText(email, contact.email);
  email.href = contact.email ? 'mailto:' + contact.email : '';
  renderLinks(section.querySelector('.link-list'), contact.socials);
}

// ---------- ch08pedia ----------

// Paragraphs split on blank lines; [[words]] show as links that don't go anywhere yet.
function renderProse(container, value) {
  container.replaceChildren(...(value || '').split(/\n\s*\n/).filter(p => p.trim()).map(paragraph => {
    const p = document.createElement('p');
    paragraph.split(/\[\[(.+?)\]\]/).forEach((part, i) => {
      if (i % 2 === 0) return p.append(part);
      const link = document.createElement('span');
      link.className = 'pedia-link';
      link.textContent = part;
      p.append(link);
    });
    return p;
  }));
}

function renderFacts(list, rows) {
  list.replaceChildren(...rows.flatMap(row => {
    const label = document.createElement('dt');
    label.textContent = row.label;
    const value = document.createElement('dd');
    value.textContent = row.value;
    return [label, value];
  }));
}

function renderMatchup(container, pedia) {
  [['left', pedia.leftImage], ['right', pedia.rightImage]].forEach(([side, src]) => {
    const img = container.querySelector(`.pedia-portrait.${side} img`);
    if (src) img.src = src;
    img.hidden = !src;
  });
  container.querySelector('tbody').replaceChildren(...pedia.matchup.map(row => {
    const tr = document.createElement('tr');
    [row.label, row.left, row.right].forEach((value, i) => {
      const cell = document.createElement(i === 0 ? 'th' : 'td');
      if (i === 0) cell.scope = 'row';
      cell.textContent = value;
      tr.append(cell);
    });
    return tr;
  }));
  container.hidden = pedia.matchup.length === 0;
}

function renderPedia(pedia) {
  const section = document.getElementById('ch08pedia');
  section.querySelector('.pedia-title').textContent = pedia.title;
  renderProse(section.querySelector('.pedia-intro'), pedia.intro);

  const box = section.querySelector('.pedia-infobox');
  setText(box.querySelector('.pedia-infobox-title'), pedia.infoboxTitle);
  const figure = box.querySelector('figure');
  if (pedia.image) figure.querySelector('img').src = pedia.image;
  figure.hidden = !pedia.image;
  setText(figure.querySelector('figcaption'), pedia.imageCaption);
  renderFacts(box.querySelector('.pedia-facts'), pedia.infobox);
  renderFacts(box.querySelector('.pedia-closing'), pedia.closing);
  renderMatchup(box.querySelector('.pedia-matchup'), pedia);
  box.hidden = !pedia.infoboxTitle && !pedia.image && !pedia.infobox.length && !pedia.matchup.length && !pedia.closing.length;

  const headings = [];
  section.querySelector('.pedia-sections').replaceChildren(...pedia.sections.map(item => {
    const block = document.createElement('section');
    if (item.heading) {
      const heading = document.createElement('h2');
      heading.textContent = item.heading;
      block.append(heading);
      headings.push([item.heading, heading]);
    }
    const body = document.createElement('div');
    renderProse(body, item.body);
    block.append(body);
    return block;
  }));

  const contents = section.querySelector('.pedia-contents');
  contents.querySelector('ol').replaceChildren(...headings.map(([label, heading]) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => heading.scrollIntoView());
    li.append(button);
    return li;
  }));
  contents.hidden = headings.length === 0;
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
      players.forEach(p => p !== player && p.pause());
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
    renderPedia(content.pedia);
    renderBeats(content.beats, content.producers);
  });
