// Public site: page switching, content from /api/content, and the beat player.
const PAGES = ['home', 'beats', 'contact'];
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

function renderContact(contact) {
  const section = document.getElementById('contact');
  setText(section.querySelector('.contact-paragraph'), contact.paragraph);
  const email = section.querySelector('.contact-email');
  setText(email, contact.email);
  email.href = contact.email ? 'mailto:' + contact.email : '';
  renderLinks(section.querySelector('.link-list'), contact.socials);
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

function createPlayer(beat) {
  const node = document.getElementById('beat-template').content.firstElementChild.cloneNode(true);
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.src = beat.audio;

  const cover = node.querySelector('.beat-cover');
  if (beat.cover) cover.querySelector('img').src = beat.cover;
  else cover.classList.add('no-cover');

  node.querySelector('.beat-title').textContent = beat.title;
  const meta = [beat.bpm && `${beat.bpm} BPM`, beat.key].filter(Boolean).join(' · ');
  setText(node.querySelector('.beat-meta'), meta);

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

  audio.addEventListener('loadedmetadata', () => { total.textContent = formatTime(audio.duration); });
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

  const player = { node, draw, pause: () => audio.pause() };
  return player;
}

function renderBeats(beats) {
  players.forEach(p => p.pause());
  players.length = 0;
  beats.forEach(beat => players.push(createPlayer(beat)));
  document.querySelector('.beat-list').replaceChildren(...players.map(p => p.node));
  document.querySelector('#beats .empty-note').hidden = beats.length > 0;
  players.forEach(p => p.draw());
}

window.addEventListener('resize', () => players.forEach(p => p.draw()));

fetch('/api/content')
  .then(res => res.json())
  .then(content => {
    renderHome(content.home);
    renderContact(content.contact);
    renderBeats(content.beats);
  });
