// Public site: page switching, content from /api/content, and the beat player.
const PAGES = ['home', 'beats', 'art', 'clips', 'election', 'wiki', 'fc', 'contact'];
const pages = document.querySelectorAll('.page');
const pageLinks = document.querySelectorAll('.menu-link[href^="/#"]');

function showPage() {
  const hash = location.hash.slice(1);
  let id = PAGES.includes(hash) ? hash : 'home';
  if (hash.startsWith('election-')) id = 'election';
  if (hash.startsWith('wiki-') || hash.startsWith('tpl-')) id = 'wiki';
  if (id === 'election' && !hash.startsWith('election-')) id = 'wiki';
  pages.forEach(p => p.hidden = p.id !== id);
  pageLinks.forEach(l => {
    const linkId = l.hash.slice(1);
    l.classList.toggle('active', linkId === id || (id === 'election' && linkId === 'wiki') || (id === 'wiki' && linkId === 'wiki'));
  });
  if (id === 'beats') requestAnimationFrame(() => players.forEach(p => p.draw()));
  if (id === 'election' && window._electionsData) renderElectionPage(window._electionsData, hash, window._censusData);
  if (id === 'wiki') {
    if (hash.startsWith('tpl-')) {
      if (window._templatePages) renderTemplatePage(window._templatePages, hash);
    } else if (hash.startsWith('wiki-')) {
      if (window._wikiPages) renderWikiPage(window._wikiPages, hash);
    } else {
      renderWikiIndex(window._wikiPages || {}, window._electionsData || {}, window._templatePages || {});
    }
  }
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
  const grid = document.querySelector('.collage-grid');
  const gifs = home.collageGifs || [];
  if (gifs.length === 0 && home.image) gifs.push(home.image);
  if (gifs.length === 0) { grid.replaceChildren(); return; }

  // Render GIFs into a 4x4 grid (first 16)
  const cells = gifs.slice(0, 16);
  grid.replaceChildren(...cells.map(url => {
    const cell = document.createElement('div');
    cell.className = 'collage-cell';
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    cell.append(img);
    return cell;
  }));
}

// ---------- Clips ----------

let clipSort = 'newest';
let clipPersonFilter = null;
let clipGameFilter = null;

function formatDuration(sec) {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

function renderClips(clips) {
  const grid = document.querySelector('.clip-grid');
  const empty = document.querySelector('#clips .empty-note');
  if (!clips || !clips.length) {
    grid.replaceChildren();
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  // Build pills
  const people = new Set();
  const games = new Set();
  clips.forEach(c => {
    (c.people || []).forEach(p => people.add(p));
    if (c.game) games.add(c.game);
  });

  function renderPills(container, values, active, onClick) {
    const allBtn = document.createElement('button');
    allBtn.className = 'clip-pill' + (active === null ? ' active' : '');
    allBtn.textContent = 'all';
    allBtn.addEventListener('click', () => onClick(null));
    container.replaceChildren(allBtn, ...[...values].sort().map(v => {
      const btn = document.createElement('button');
      btn.className = 'clip-pill' + (active === v ? ' active' : '');
      btn.textContent = v;
      btn.addEventListener('click', () => onClick(v));
      return btn;
    }));
  }

  renderPills(document.querySelector('.people-pills'), people, clipPersonFilter, v => {
    clipPersonFilter = v;
    renderClips(clips);
  });
  renderPills(document.querySelector('.game-pills'), games, clipGameFilter, v => {
    clipGameFilter = v;
    renderClips(clips);
  });

  // Filter
  let filtered = clips.filter(c => {
    if (clipPersonFilter && !(c.people || []).includes(clipPersonFilter)) return false;
    if (clipGameFilter && c.game !== clipGameFilter) return false;
    return true;
  });

  // Sort
  filtered = [...filtered].sort((a, b) => {
    if (clipSort === 'newest') return (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || '');
    if (clipSort === 'oldest') return (a.date || a.createdAt || '').localeCompare(b.date || b.createdAt || '');
    if (clipSort === 'shortest') return (a.duration || 9999) - (b.duration || 9999);
    if (clipSort === 'longest') return (b.duration || 0) - (a.duration || 0);
    return 0;
  });

  grid.replaceChildren(...filtered.map(clip => {
    const card = document.createElement('div');
    card.className = 'clip-card';

    const video = document.createElement('video');
    video.src = clip.video;
    video.preload = 'metadata';
    video.muted = true;
    video.loop = true;
    video.playsInline = true;

    const info = document.createElement('div');
    info.className = 'clip-info';

    const title = document.createElement('p');
    title.className = 'clip-title';
    title.textContent = clip.title;

    const meta = document.createElement('p');
    meta.className = 'clip-meta';
    const parts = [];
    if (clip.date) parts.push(clip.date);
    if (clip.duration) parts.push(formatDuration(clip.duration));
    if (clip.game) parts.push(clip.game);
    meta.textContent = parts.join(' · ');

    const tags = document.createElement('div');
    tags.className = 'clip-tags';
    (clip.people || []).forEach(p => {
      const tag = document.createElement('span');
      tag.className = 'clip-tag';
      tag.textContent = p;
      tags.append(tag);
    });

    info.append(title, meta);
    if (clip.people?.length) info.append(tags);
    card.append(video, info);

    card.addEventListener('click', () => {
      const wasExpanded = card.classList.contains('expanded');
      grid.querySelectorAll('.clip-card.expanded').forEach(c => {
        c.classList.remove('expanded');
        c.querySelector('video').pause();
        c.querySelector('video').muted = true;
        c.querySelector('video').controls = false;
      });
      if (!wasExpanded) {
        card.classList.add('expanded');
        video.muted = false;
        video.controls = true;
        video.currentTime = 0;
        video.play();
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    card.addEventListener('mouseenter', () => {
      if (!card.classList.contains('expanded')) video.play().catch(() => {});
    });
    card.addEventListener('mouseleave', () => {
      if (!card.classList.contains('expanded')) { video.pause(); video.currentTime = 0; }
    });

    return card;
  }));
}

document.getElementById('clip-sort')?.addEventListener('change', function() {
  clipSort = this.value;
  if (window._clipData) renderClips(window._clipData);
});

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

// ---------- Election ----------

function buildElectionMap(stateColors, candidates, censusEvs) {
  if (typeof US_STATES === 'undefined' || !stateColors || !Object.keys(stateColors).length) return null;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 1020 593');
  svg.setAttribute('xmlns', ns);
  svg.style.width = '100%';
  svg.style.height = 'auto';

  const smallStates = [];
  US_STATES.forEach(s => {
    const color = stateColors[s.id] || '#d0d0d0';
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', s.path);
    path.setAttribute('fill', color);
    path.setAttribute('stroke', '#fff');
    path.setAttribute('stroke-width', '1.2');
    svg.append(path);

    if (s.small) {
      smallStates.push(s);
    } else {
      const txt = document.createElementNS(ns, 'text');
      txt.setAttribute('x', s.labelX);
      txt.setAttribute('y', s.labelY);
      txt.setAttribute('font-size', '28');
      txt.setAttribute('font-weight', 'bold');
      txt.setAttribute('font-family', 'Helvetica Neue, Helvetica, Arial, sans-serif');
      txt.setAttribute('fill', '#000');
      txt.setAttribute('pointer-events', 'none');
      txt.textContent = String(censusEvs?.[s.id] ?? s.ev);
      svg.append(txt);
    }
  });

  smallStates.forEach(s => {
    const color = stateColors[s.id] || '#d0d0d0';
    const ev = censusEvs?.[s.id] ?? s.ev;
    const g = document.createElementNS(ns, 'g');
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', s.labelX - 16);
    rect.setAttribute('y', s.labelY - 16);
    rect.setAttribute('width', 14);
    rect.setAttribute('height', 14);
    rect.setAttribute('fill', color);
    rect.setAttribute('stroke', '#000');
    rect.setAttribute('stroke-width', '0.8');
    const txt = document.createElementNS(ns, 'text');
    txt.setAttribute('x', s.labelX);
    txt.setAttribute('y', s.labelY);
    txt.setAttribute('font-size', '22');
    txt.setAttribute('font-family', 'Helvetica Neue, Helvetica, Arial, sans-serif');
    txt.setAttribute('fill', '#000');
    txt.textContent = `${s.abbr} ${ev}`;
    g.append(rect, txt);
    svg.append(g);
  });

  const cands = (candidates || []).filter(c => c.partyColor);
  if (cands.length) {
    const legendX = 828;
    let legendY = 406;
    cands.forEach((c, i) => {
      const y = legendY + i * 33;
      const swatch = document.createElementNS(ns, 'rect');
      swatch.setAttribute('x', legendX);
      swatch.setAttribute('y', y);
      swatch.setAttribute('width', 19);
      swatch.setAttribute('height', 19);
      swatch.setAttribute('fill', c.partyColor);
      swatch.setAttribute('stroke', '#000');
      swatch.setAttribute('stroke-width', '0.8');
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', legendX + 27);
      label.setAttribute('y', y + 15);
      label.setAttribute('font-size', '28');
      label.setAttribute('font-weight', 'bold');
      label.setAttribute('font-family', 'Helvetica Neue, Helvetica, Arial, sans-serif');
      label.setAttribute('fill', '#000');
      label.textContent = c.name?.split(' ').pop() || c.party || '';
      svg.append(swatch, label);
    });
  }
  const lines = document.createElementNS(ns, 'path');
  lines.setAttribute('d', 'm844 62 13 29m-25-5 8 17m49 50 34 3m-41 22 41 12m-57-6 51 33m-72 13 50 22m-58-2 51 26m-55-15 46 33m-79-43 61 61');
  lines.setAttribute('stroke', '#000');
  lines.setAttribute('stroke-width', '1.6');
  lines.setAttribute('fill', 'none');
  svg.append(lines);

  const frames = document.createElementNS(ns, 'path');
  frames.setAttribute('d', 'M215,493v55l36,45 M0,425h147l68,68h85l54,54v46');
  frames.setAttribute('fill', 'none');
  frames.setAttribute('stroke', '#a9a9a9');
  frames.setAttribute('stroke-width', '2');
  svg.append(frames);

  return svg;
}

function applyHighlightWords(html, highlightWords, links) {
  if (!highlightWords) return html;
  const words = highlightWords.split(',').map(w => w.trim()).filter(Boolean);
  if (!words.length) return html;
  const linkMap = links || (window._highlightLinks ? window._highlightLinks : {});
  const lowerMap = {};
  for (const [k, v] of Object.entries(linkMap)) lowerMap[k.toLowerCase()] = v;
  const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp('(' + escaped.join('|') + ')', 'gi');
  return html.replace(re, (match) => {
    const url = lowerMap[match.toLowerCase()];
    if (url) {
      const isExternal = url.startsWith('http://') || url.startsWith('https://');
      const target = isExternal ? ' target="_blank" rel="noopener"' : '';
      const href = url.startsWith('#') ? '/' + url : url;
      return `<a href="${href}" style="color:#0645ad;text-decoration:none"${target}>${match}</a>`;
    }
    return `<span style="color:#0645ad;cursor:pointer">${match}</span>`;
  });
}

document.addEventListener('click', e => {
  const span = e.target.closest('span');
  if (!span) return;
  const color = getComputedStyle(span).color;
  if (color !== 'rgb(6, 69, 173)') return;
  const links = window._highlightLinks || {};
  const text = span.textContent.trim();
  const lowerMap = {};
  for (const [k, v] of Object.entries(links)) lowerMap[k.toLowerCase()] = v;
  const url = lowerMap[text.toLowerCase()];
  if (!url) return;
  e.preventDefault();
  if (url.startsWith('http://') || url.startsWith('https://')) {
    window.open(url, '_blank', 'noopener');
  } else if (url.startsWith('#')) {
    location.hash = url;
  } else {
    location.href = url;
  }
});

function renderElectionIndex(elections) {
  const section = document.getElementById('election');
  const body = section.querySelector('.wiki-body');
  const emptyNote = section.querySelector('.empty-note');
  const slugs = Object.keys(elections).sort((a, b) => b.localeCompare(a));
  if (slugs.length === 0) {
    body.hidden = true;
    emptyNote.hidden = false;
    return;
  }
  body.hidden = false;
  emptyNote.hidden = true;
  const title = section.querySelector('.wiki-title');
  title.textContent = 'United States presidential elections';
  // Hide infobox
  section.querySelector('.wiki-infobox-wrap').hidden = true;
  section.querySelector('.wiki-lead').hidden = true;
  section.querySelector('.wiki-toc').hidden = true;
  const nav = section.querySelector('.wiki-election-nav');
  if (nav) nav.hidden = true;
  const ecInfo = section.querySelector('.wiki-ec-info');
  if (ecInfo) ecInfo.hidden = true;
  const presInfo = section.querySelector('.wiki-president-info');
  if (presInfo) presInfo.hidden = true;
  // Render list of elections
  const sectionsDiv = section.querySelector('.wiki-sections');
  sectionsDiv.innerHTML = '';
  const list = document.createElement('div');
  list.className = 'wiki-section';
  slugs.forEach(slug => {
    const e = elections[slug];
    const p = document.createElement('p');
    const a = document.createElement('a');
    a.href = `#election-${slug}`;
    a.textContent = e.title || slug;
    a.style.color = '#0645ad';
    a.style.textDecoration = 'none';
    a.style.cursor = 'pointer';
    a.style.fontSize = '16px';
    p.append(a);
    if (e.electionDate) {
      const span = document.createElement('span');
      span.textContent = ` — ${e.electionDate}`;
      span.style.color = '#54595d';
      p.append(span);
    }
    list.append(p);
  });
  sectionsDiv.append(list);
}

function getActiveCensus(electionYear, censusData) {
  if (!censusData || !electionYear) return null;
  const censusYears = Object.keys(censusData).map(Number).filter(y => !isNaN(y) && y < electionYear).sort((a, b) => b - a);
  return censusYears.length ? censusData[String(censusYears[0])] : null;
}

function renderElectionPage(elections, hash, censusData) {
  if (hash.startsWith('election-')) {
    const slug = hash.slice('election-'.length);
    const election = elections[slug];
    if (election) {
      document.getElementById('election').querySelector('.wiki-infobox-wrap').hidden = false;
      const yearMatch = slug.match(/\d{4}/);
      const activeCensus = yearMatch ? getActiveCensus(parseInt(yearMatch[0]), censusData) : null;
      renderElection(election, activeCensus);
      return;
    }
  }
  renderElectionIndex(elections);
}

function renderElection(election, activeCensus) {
  const section = document.getElementById('election');
  const body = section.querySelector('.wiki-body');
  const emptyNote = section.querySelector('.empty-note');

  if (!election || (!election.title && !(election.candidates || []).length && !(election.sections || []).length)) {
    body.hidden = true;
    emptyNote.hidden = false;
    return;
  }
  body.hidden = false;
  emptyNote.hidden = true;

  section.querySelector('.wiki-title').textContent = election.title || '';
  section.querySelector('.wiki-infobox-title').textContent = election.infobox || election.title || '';

  const candidateCount = (election.candidates || []).length;
  const infoboxWrap = section.querySelector('.wiki-infobox-wrap');
  infoboxWrap.style.width = candidateCount === 3 ? '420px' : '';

  const flagDiv = section.querySelector('.wiki-infobox-flag');
  const W = 190, H = 100, sh = H / 13, uw = W * 2 / 5, uh = sh * 7;
  let flagSvg = '';
  for (let i = 0; i < 13; i++) flagSvg += `<rect y="${i*sh}" width="${W}" height="${sh}" fill="${i%2?'#fff':'#B22234'}"/>`;
  flagSvg += `<rect width="${uw}" height="${uh}" fill="#3C3B6E"/>`;
  for (let r = 0; r < 9; r++) {
    const n = r % 2 === 0 ? 6 : 5;
    const sx = r % 2 === 0 ? uw/12 : uw/6;
    const sy = uh/10;
    for (let c = 0; c < n; c++) flagSvg += `<circle cx="${sx + c*(uw/6)}" cy="${sy + r*(uh/10)}" r="1.6" fill="#fff"/>`;
  }
  flagDiv.innerHTML = `<svg class="wiki-infobox-flag-img" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${flagSvg}</svg>`;

  const navRow = section.querySelector('.wiki-election-nav');
  if (election.electionDate) {
    const yearMatch = (election.electionDate || '').match(/\d{4}/);
    const year = yearMatch ? parseInt(yearMatch[0]) : null;
    const prev = year ? year - 4 : '';
    const next = year ? year + 4 : '';
    navRow.innerHTML = `<a href="#election-${prev}" class="wiki-nav-prev" style="color:#0645ad;cursor:pointer;text-decoration:none">← ${prev}</a><span class="wiki-nav-date">${election.electionDate}</span><a href="#election-${next}" class="wiki-nav-next" style="color:#0645ad;cursor:pointer;text-decoration:none">${next} →</a>`;
    navRow.hidden = false;
  } else {
    navRow.hidden = true;
  }

  const ecInfo = section.querySelector('.wiki-ec-info');
  const ecTotal = activeCensus ? Object.values(activeCensus).reduce((s, v) => s + v, 0) : 538;
  const ecMajority = Math.floor(ecTotal / 2) + 1;
  ecInfo.innerHTML = `<div>${ecTotal} members of the <span style="color:#0645ad;cursor:pointer">Electoral College</span></div><div>${ecMajority} electoral votes needed to win</div>`;
  ecInfo.hidden = false;

  section.querySelector('.wiki-turnout-row').hidden = true;

  const gallery = section.querySelector('.wiki-nominee-gallery');
  const candidates = election.candidates || [];
  gallery.innerHTML = '';
  if (candidates.length) {
    const fields = [
      { label: 'Nominee', key: 'name', bold: true, link: true },
      { label: 'Party', key: 'party', link: true },
      { label: 'Home state', key: 'homeState', link: true },
      { label: 'Running mate', key: 'runningMate', bold: true, link: true },
      { label: 'Electoral vote', key: 'electoralVotes', numeric: true },
      { label: 'States carried', key: 'statesCarried', statesHighlight: true, numeric: true },
      { label: 'Popular vote', key: 'popularVotes', numeric: true },
      { label: 'Percentage', key: 'popularPct', numeric: true },
    ];

    function buildCandidateTable(cands, allCandidates, showTurnout) {
      const tbl = document.createElement('table');
      tbl.className = 'wiki-ib-table';
      const colGroup = document.createElement('colgroup');
      const labelCol = document.createElement('col');
      labelCol.style.width = '90px';
      colGroup.append(labelCol);
      const candWidth = ((100 - 27) / cands.length).toFixed(2) + '%';
      cands.forEach(() => {
        const col = document.createElement('col');
        col.style.width = candWidth;
        colGroup.append(col);
      });
      tbl.append(colGroup);

      if (showTurnout && election.turnout) {
        const tRow = document.createElement('tr');
        const tTh = document.createElement('th');
        tTh.textContent = 'Turnout';
        tTh.style.cssText = 'text-align:left;padding:2px 6px;font-size:12px;font-weight:700;vertical-align:top;white-space:nowrap';
        tRow.append(tTh);
        const tTd = document.createElement('td');
        tTd.colSpan = cands.length;
        tTd.style.cssText = 'text-align:center;padding:2px 4px;font-size:12px';
        let turnoutHtml = election.turnout.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        if (election.turnoutChange) {
          const val = parseFloat(election.turnoutChange);
          if (!isNaN(val)) {
            const svg = val >= 0
              ? '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 300 300" style="vertical-align:baseline"><polygon points="0 300 300 300 150 0" fill="#0C3"/></svg>'
              : '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 300 300" style="vertical-align:baseline"><polygon points="0 0 150 300 300 0" fill="#F00"/></svg>';
            const abs = Math.abs(val);
            turnoutHtml += ` ${svg} ${abs} <span style="color:#0645ad;cursor:pointer">pp</span>`;
          }
        }
        tTd.innerHTML = turnoutHtml;
        tRow.append(tTd);
        tbl.append(tRow);
      }

      const photoRow = document.createElement('tr');
      const emptyTd = document.createElement('td');
      photoRow.append(emptyTd);
      cands.forEach(c => {
        const td = document.createElement('td');
        td.style.textAlign = 'center';
        td.style.padding = '1px 0 0';
        td.style.verticalAlign = 'bottom';
        if (c.image) {
          const img = document.createElement('img');
          img.src = c.image;
          img.alt = c.name;
          img.className = 'wiki-nominee-photo';
          td.append(img);
        }
        if (c.partyColor) {
          const bar = document.createElement('div');
          bar.style.cssText = `height:6px;background:${c.partyColor};margin-top:0;`;
          bar.className = 'wiki-party-bar';
          td.append(bar);
        }
        photoRow.append(td);
      });
      tbl.append(photoRow);

      fields.forEach(f => {
        const vals = cands.map(c => c[f.key] || '');
        if (vals.every(v => !v)) return;
        const allVals = allCandidates.map(c => c[f.key] || '');
        let highIdx = -1;
        if (f.numeric && allVals.filter(v => v).length > 1) {
          const allNums = allCandidates.map(c => parseFloat(String(c[f.key] || '').replace(/[,%]/g, '')));
          const max = Math.max(...allNums.filter(n => !isNaN(n)));
          if (!isNaN(max)) {
            const globalWinner = allCandidates.findIndex(c => parseFloat(String(c[f.key] || '').replace(/[,%]/g, '')) === max);
            highIdx = cands.indexOf(allCandidates[globalWinner]);
          }
        }
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.textContent = f.label;
        th.style.cssText = 'text-align:left;padding:2px 6px;font-size:12px;font-weight:700;vertical-align:top;white-space:nowrap';
        tr.append(th);
        cands.forEach((c, i) => {
          const td = document.createElement('td');
          td.style.cssText = 'text-align:center;padding:2px 4px;font-size:12px';
          if (f.link) {
            const span = document.createElement('span');
            span.textContent = vals[i];
            span.style.cssText = 'color:#0645ad;cursor:pointer;';
            if (f.bold) span.style.fontWeight = '700';
            td.append(span);
          } else if (f.statesHighlight && vals[i]) {
            const escaped = vals[i].replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            td.innerHTML = escaped.replace(/\b([A-Z]{2}(?:-\d{2})?)\b/g, '<span style="color:#0645ad;cursor:pointer">$1</span>');
            if (f.bold) td.style.fontWeight = '700';
          } else {
            td.textContent = vals[i];
            if (f.bold) td.style.fontWeight = '700';
          }
          if (highIdx === i) td.style.fontWeight = '700';
          tr.append(td);
        });
        tbl.append(tr);
      });
      return tbl;
    }

    if (candidates.length > 3) {
      const sorted = [...candidates].sort((a, b) => {
        const evA = parseFloat(String(a.electoralVotes || '0').replace(/[,%]/g, ''));
        const evB = parseFloat(String(b.electoralVotes || '0').replace(/[,%]/g, ''));
        return (isNaN(evB) ? 0 : evB) - (isNaN(evA) ? 0 : evA);
      });
      const topRow = sorted.slice(0, 2);
      const bottomRow = sorted.slice(2);
      gallery.append(buildCandidateTable(topRow, candidates, true));
      gallery.append(buildCandidateTable(bottomRow, candidates, false));
    } else {
      gallery.append(buildCandidateTable(candidates, candidates, true));
    }
  }

  section.querySelector('.wiki-candidate-table').hidden = true;

  const mapContainer = section.querySelector('.wiki-map');
  mapContainer.innerHTML = '';
  const stateMap = buildElectionMap(election.stateColors, candidates, activeCensus);
  if (stateMap) {
    mapContainer.append(stateMap);
    mapContainer.hidden = false;
  } else if (election.mapImage) {
    const img = document.createElement('img');
    img.src = election.mapImage;
    img.alt = 'Electoral map';
    mapContainer.append(img);
    mapContainer.hidden = false;
  } else {
    mapContainer.hidden = true;
  }

  const mapCaption = section.querySelector('.wiki-map-caption');
  if (election.mapCaption) {
    const captionEsc = election.mapCaption.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const colorMap = {};
    (candidates || []).forEach(c => {
      if (c.partyColorName && c.partyColor) colorMap[c.partyColorName.toLowerCase()] = c.partyColor;
    });
    Object.assign(colorMap, { blue: '#244999', red: '#d22532', yellow: '#c8a800', green: '#6bb74a' });
    const colorNames = Object.keys(colorMap).sort((a, b) => b.length - a.length);
    const colorRe = new RegExp('\\b(' + colorNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'gi');
    mapCaption.innerHTML = captionEsc.replace(colorRe, (m) => `<span style="color:${colorMap[m.toLowerCase()]}">${m}</span>`);
    mapCaption.hidden = false;
  } else {
    mapCaption.hidden = true;
  }

  const presInfo = section.querySelector('.wiki-president-info');
  if (election.presidentBefore || election.electedPresident) {
    presInfo.innerHTML = `<div class="wiki-pres-row">
      <div class="wiki-pres-col"><div class="wiki-pres-label">President before election</div><div class="wiki-pres-name">${election.presidentBefore || ''}</div><div class="wiki-pres-party">${election.presidentBeforeParty || ''}</div></div>
      <div class="wiki-pres-col wiki-pres-right"><div class="wiki-pres-label">Elected President</div><div class="wiki-pres-name">${election.electedPresident || ''}</div><div class="wiki-pres-party">${election.electedPresidentParty || ''}</div></div>
    </div>`;
    presInfo.hidden = false;
  } else {
    presInfo.hidden = true;
  }

  const leadDiv = section.querySelector('.wiki-lead');
  if (election.lead) {
    leadDiv.innerHTML = '';
    election.lead.split('\n\n').forEach(para => {
      const p = document.createElement('p');
      p.className = 'wiki-lead-para';
      let escaped = para.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      escaped = applyHighlightWords(escaped, election.highlightWords);
      p.innerHTML = escaped.replace(/\n/g, '<br>');
      leadDiv.append(p);
    });
    leadDiv.hidden = false;
  } else {
    leadDiv.hidden = true;
  }

  const toc = section.querySelector('.wiki-toc');
  const tocList = section.querySelector('.wiki-toc-list');
  const sections = election.sections || [];
  if (sections.filter(s => s.heading).length > 1) {
    tocList.innerHTML = '';
    sections.forEach((s, i) => {
      if (!s.heading) return;
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#wiki-sec-${i}`;
      a.textContent = s.heading;
      li.append(a);
      tocList.append(li);
    });
    toc.hidden = false;
  } else {
    toc.hidden = true;
  }

  const sectionsDiv = section.querySelector('.wiki-sections');
  sectionsDiv.replaceChildren(...sections.map((s, i) => {
    const div = document.createElement('div');
    div.className = 'wiki-section';
    if (s.heading) {
      div.id = `wiki-sec-${i}`;
      const h2 = document.createElement('h2');
      const span = document.createElement('span');
      span.textContent = s.heading;
      h2.append(span);
      div.append(h2);
    }
    if (s.text) {
      s.text.split('\n\n').forEach(para => {
        const p = document.createElement('p');
        const esc = para.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        p.innerHTML = applyHighlightWords(esc, election.highlightWords);
        div.append(p);
      });
    }
    return div;
  }));
}

// ---------- fc/fifa stats ----------

const ALL = 'all';
let fcData = Object.fromEntries(Object.keys(FC_SCHEMA).map(table => [table, []]));
const fcView = { game: ALL, season: ALL };
// Current sort per table; clicking a column header changes it.
const fcSort = {
  proClubs: { key: 'goals', desc: true },
  careerPlayers: { key: 'goals', desc: true },
  careerSeasons: { key: 'season', desc: false },
};

const fieldOf = (table, key) => FC_SCHEMA[table].fields.find(f => f.key === key);

function formatStat(field, value) {
  if (value == null || value === '') return '–';
  if (field.type === 'rating') return Number(value).toFixed(1);
  if (field.type === 'pct') return `${Math.round(value * 10) / 10}%`;
  return String(value);
}

// Combines one player's rows (several games or seasons) into all-time totals.
// Totals add up; averages are weighted by matches/appearances when known.
function combinePlayers(table, rows) {
  const schema = FC_SCHEMA[table];
  const groups = new Map();
  rows.forEach(row => {
    const key = row.player.trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return [...groups.values()].map(group => {
    const combined = {
      player: group[0].player,
      me: group.some(r => r.me),
      position: group.map(r => r.position).filter(Boolean).at(-1) || '',
    };
    schema.fields.forEach(field => {
      const values = group.filter(r => r[field.key] != null);
      if (field.total) {
        combined[field.key] = values.length ? values.reduce((sum, r) => sum + r[field.key], 0) : null;
      } else if (field.average) {
        const weighted = values.filter(r => r[schema.weight] > 0);
        const weight = weighted.reduce((sum, r) => sum + r[schema.weight], 0);
        combined[field.key] = weight
          ? weighted.reduce((sum, r) => sum + r[field.key] * r[schema.weight], 0) / weight
          : values.length ? values.reduce((sum, r) => sum + r[field.key], 0) / values.length : null;
      }
    });
    return combined;
  });
}

function compareStat(a, b, key, desc) {
  const x = a[key];
  const y = b[key];
  if (x == null && y == null) return 0;
  if (x == null) return 1;
  if (y == null) return -1;
  const order = typeof x === 'string' ? x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' }) : x - y;
  return desc ? -order : order;
}

// Draws a sortable table. `columns` are field keys from the schema, plus optional computed columns.
function renderStatTable(table, rows, columns, emptyText) {
  const container = document.querySelector(`.fc-table[data-table="${table}"]`);
  if (!rows.length) {
    const note = document.createElement('p');
    note.className = 'empty-note';
    note.textContent = emptyText;
    return container.replaceChildren(note);
  }
  const sort = fcSort[table];
  const sorted = [...rows].sort((a, b) => compareStat(a, b, sort.key, sort.desc));

  const tableEl = document.createElement('table');
  const head = tableEl.createTHead().insertRow();
  columns.forEach(column => {
    const th = document.createElement('th');
    th.scope = 'col';
    const field = column.field || fieldOf(table, column.key);
    if (field.type === 'text') th.className = 'text';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = field.short || field.label;
    button.title = field.label;
    if (sort.key === column.key) th.setAttribute('aria-sort', sort.desc ? 'descending' : 'ascending');
    button.addEventListener('click', () => {
      // Numbers start high-to-low; text starts a–z.
      const numeric = !['text', 'choice'].includes(field.type);
      fcSort[table] = sort.key === column.key ? { key: column.key, desc: !sort.desc } : { key: column.key, desc: numeric };
      renderFc();
    });
    th.append(button);
    head.append(th);
  });

  const body = tableEl.createTBody();
  sorted.forEach(row => {
    const tr = body.insertRow();
    if (row.me) tr.className = 'is-me';
    columns.forEach((column, i) => {
      const cell = document.createElement(i === 0 ? 'th' : 'td');
      if (i === 0) cell.scope = 'row';
      const field = column.field || fieldOf(table, column.key);
      if (field.type === 'text') cell.className = 'text';
      cell.textContent = formatStat(field, row[column.key]);
      if (column.key === 'player' && row.me) {
        const tag = document.createElement('span');
        tag.className = 'me-tag';
        tag.textContent = 'me';
        cell.append(' ', tag);
      }
      tr.append(cell);
    });
  });

  const wrap = document.createElement('div');
  wrap.className = 'fc-scroll';
  wrap.tabIndex = 0;
  wrap.setAttribute('role', 'region');
  wrap.setAttribute('aria-label', `${FC_SCHEMA[table].title} table`);
  wrap.append(tableEl);
  container.replaceChildren(wrap);
}

function renderFilters(kind, values) {
  const container = document.querySelector(`.fc-filters[data-filter="${kind}"]`);
  if (!values.includes(fcView[kind])) fcView[kind] = ALL;
  container.replaceChildren(...[ALL, ...values].map(value => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter-pill';
    button.textContent = value === ALL ? 'all-time' : value;
    const active = fcView[kind] === value;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active);
    button.addEventListener('click', () => {
      fcView[kind] = value;
      renderFc();
    });
    return button;
  }));
}

const columnsOf = (table, skip) => FC_SCHEMA[table].fields.filter(f => !skip.includes(f.key)).map(f => ({ key: f.key }));

function renderFc() {
  // Pro clubs: one game, or every game combined per player.
  renderFilters('game', fieldOf('proClubs', 'game').options);
  const proRows = fcView.game === ALL
    ? combinePlayers('proClubs', fcData.proClubs)
    : fcData.proClubs.filter(r => r.game === fcView.game);
  renderStatTable('proClubs', proRows, columnsOf('proClubs', ['game', 'me']),
    fcView.game === ALL ? 'no pro clubs stats yet' : `no ${fcView.game} stats yet`);

  // Career mode: every season in any of the three career tables.
  const seasons = [...new Set(['careerSeasons', 'careerPlayers', 'trophies']
    .flatMap(table => fcData[table].map(r => r.season)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  renderFilters('season', seasons);
  const inSeason = row => fcView.season === ALL || row.season === fcView.season;

  const seasonRows = fcData.careerSeasons.filter(inSeason).map(row => ({
    ...row,
    goalDiff: row.goalsFor != null && row.goalsAgainst != null ? row.goalsFor - row.goalsAgainst : null,
  }));
  const seasonColumns = columnsOf('careerSeasons', ['points']);
  seasonColumns.push({ key: 'goalDiff', field: { label: 'goal difference', short: 'gd', type: 'int' } }, { key: 'points' });
  renderStatTable('careerSeasons', seasonRows, seasonColumns, 'no seasons yet');

  const playerRows = fcView.season === ALL
    ? combinePlayers('careerPlayers', fcData.careerPlayers)
    : fcData.careerPlayers.filter(inSeason);
  renderStatTable('careerPlayers', playerRows, columnsOf('careerPlayers', ['season']), 'no player stats yet');

  const trophies = fcData.trophies.filter(inSeason)
    .sort((a, b) => (a.season || '').localeCompare(b.season || '', undefined, { numeric: true }));
  const list = document.querySelector('.fc-trophies');
  if (!trophies.length) {
    const li = document.createElement('li');
    li.className = 'empty-note';
    li.textContent = 'no trophies yet';
    return list.replaceChildren(li);
  }
  list.replaceChildren(...trophies.map(trophy => {
    const li = document.createElement('li');
    li.className = 'fc-trophy';
    li.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>');
    const name = document.createElement('span');
    name.className = 'fc-trophy-name';
    name.textContent = trophy.name;
    const season = document.createElement('span');
    season.className = 'fc-trophy-season';
    season.textContent = trophy.season;
    li.append(name, season);
    return li;
  }));
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

// ---------- Wiki Pages ----------

function renderWikiIndex(pages, elections, templates) {
  const section = document.getElementById('wiki');
  if (!section) return;
  const body = section.querySelector('.wiki-body');
  const title = section.querySelector('.wiki-title');
  title.textContent = 'Wikipedia';
  section.querySelector('.wiki-from').textContent = 'From Wikipedia, the free encyclopedia';
  section.querySelector('.wiki-infobox-wrap').hidden = true;
  section.querySelector('.wiki-lead').hidden = true;
  section.querySelector('.wiki-toc').hidden = true;
  const sectionsDiv = section.querySelector('.wiki-sections');
  sectionsDiv.innerHTML = '';

  const pageSlugs = Object.keys(pages || {}).sort();
  const electionSlugs = Object.keys(elections || {}).sort((a, b) => b.localeCompare(a));

  if (pageSlugs.length) {
    const h = document.createElement('h2');
    h.id = 'wiki-index-pages';
    h.className = 'wiki-section-heading';
    h.textContent = 'Pages';
    sectionsDiv.append(h);
    const list = document.createElement('div');
    list.className = 'wiki-section';
    list.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    pageSlugs.forEach(slug => {
      const page = pages[slug];
      const p = document.createElement('p');
      const a = document.createElement('a');
      a.href = `#wiki-${slug}`;
      a.textContent = page.name || slug;
      a.style.color = '#0645ad';
      a.style.textDecoration = 'none';
      p.append(a);
      list.append(p);
    });
    sectionsDiv.append(list);
  }

  if (electionSlugs.length) {
    const h = document.createElement('h2');
    h.id = 'wiki-index-elections';
    h.className = 'wiki-section-heading';
    h.textContent = 'Elections';
    sectionsDiv.append(h);
    const list = document.createElement('div');
    list.className = 'wiki-section';
    list.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    electionSlugs.forEach(slug => {
      const e = elections[slug];
      const p = document.createElement('p');
      const a = document.createElement('a');
      a.href = `#election-${slug}`;
      a.textContent = e.title || `${slug} United States presidential election`;
      a.style.color = '#0645ad';
      a.style.textDecoration = 'none';
      p.append(a);
      if (e.electionDate) {
        const span = document.createElement('span');
        span.textContent = ` — ${e.electionDate}`;
        span.style.color = '#54595d';
        p.append(span);
      }
      list.append(p);
    });
    sectionsDiv.append(list);
  }

  const tplSlugs = Object.keys(templates || {}).sort();
  if (tplSlugs.length) {
    const h = document.createElement('h2');
    h.id = 'wiki-index-templates';
    h.className = 'wiki-section-heading';
    h.textContent = 'Lists';
    sectionsDiv.append(h);
    const list = document.createElement('div');
    list.className = 'wiki-section';
    list.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    tplSlugs.forEach(slug => {
      const tpl = templates[slug];
      const p = document.createElement('p');
      const a = document.createElement('a');
      a.href = `#tpl-${slug}`;
      a.textContent = tpl.title || slug;
      a.style.color = '#0645ad';
      a.style.textDecoration = 'none';
      p.append(a);
      list.append(p);
    });
    sectionsDiv.append(list);
  }

  if (!pageSlugs.length && !electionSlugs.length && !tplSlugs.length) {
    sectionsDiv.innerHTML = '<p class="empty-note">no wiki pages yet</p>';
  }
}

function renderWikiPage(pages, hash) {
  const section = document.getElementById('wiki');
  if (!section) return;
  if (!hash.startsWith('wiki-')) return;
  const slug = hash.slice('wiki-'.length);
  const page = pages[slug];
  if (!page || !page.name) {
    section.querySelector('.wiki-body').innerHTML = '<p>Page not found.</p>';
    return;
  }

  const title = section.querySelector('.wiki-title');
  title.textContent = page.name;

  const infoboxWrap = section.querySelector('.wiki-infobox-wrap');
  infoboxWrap.hidden = false;
  infoboxWrap.style.width = '';

  const ib = section.querySelector('.wiki-person-infobox');
  ib.innerHTML = '';

  // Name header
  const nameRow = document.createElement('tr');
  const nameTh = document.createElement('th');
  nameTh.colSpan = 2;
  nameTh.style.cssText = 'text-align:center;font-size:125%;font-weight:700;padding:6px 4px;border-bottom:none;background:#f8f9fa;';
  nameTh.textContent = page.name;
  nameRow.append(nameTh);
  ib.append(nameRow);

  // Photo
  if (page.photo) {
    const photoRow = document.createElement('tr');
    const photoTd = document.createElement('td');
    photoTd.colSpan = 2;
    photoTd.style.cssText = 'text-align:center;padding:4px;border-bottom:none;';
    const img = document.createElement('img');
    img.src = page.photo;
    img.alt = page.name;
    img.style.cssText = 'width:250px;max-width:100%;';
    photoTd.append(img);
    if (page.photoCaption) {
      const cap = document.createElement('div');
      cap.style.cssText = 'font-size:12px;color:#54595d;margin-top:2px;';
      cap.textContent = page.photoCaption;
      photoTd.append(cap);
    }
    photoRow.append(photoTd);
    ib.append(photoRow);
  }

  // Offices
  (page.offices || []).forEach(office => {
    if (office.title) {
      const titleRow = document.createElement('tr');
      const titleTd = document.createElement('td');
      titleTd.colSpan = 2;
      titleTd.style.cssText = 'text-align:center;padding:4px 4px;background:#b0c4de;font-weight:700;font-size:14px;border-bottom:none;';
      const titleLink = document.createElement('span');
      titleLink.textContent = office.title;
      titleLink.style.cssText = 'color:#0645ad;';
      titleTd.append(titleLink);
      titleRow.append(titleTd);
      ib.append(titleRow);
    }
    if (office.subtitle || office.dates) {
      const subRow = document.createElement('tr');
      const subTd = document.createElement('td');
      subTd.colSpan = 2;
      subTd.style.cssText = 'text-align:center;padding:2px 8px;font-size:13px;border-bottom:none;';
      if (office.subtitle) {
        const subSpan = document.createElement('div');
        subSpan.style.cssText = 'font-style:italic;color:#54595d;';
        subSpan.textContent = office.subtitle;
        subTd.append(subSpan);
      }
      if (office.dates) {
        const dateDiv = document.createElement('div');
        dateDiv.style.cssText = 'font-size:13px;color:#202122;';
        dateDiv.textContent = office.dates;
        subTd.append(dateDiv);
      }
      subRow.append(subTd);
      ib.append(subRow);
    }
    (office.fields || []).forEach(f => {
      if (!f.label && !f.value) return;
      const fRow = document.createElement('tr');
      const fTh = document.createElement('th');
      fTh.style.cssText = 'text-align:left;padding:4px 8px;font-size:14px;font-weight:700;vertical-align:top;width:40%;border-bottom:none;';
      fTh.textContent = f.label;
      const fTd = document.createElement('td');
      fTd.style.cssText = 'padding:4px 8px;font-size:14px;border-bottom:none;';
      const valSpan = document.createElement('span');
      valSpan.textContent = f.value;
      valSpan.style.cssText = 'color:#0645ad;';
      fTd.append(valSpan);
      fRow.append(fTh, fTd);
      ib.append(fRow);
    });
  });

  // Personal details
  const eduEntries = (page.educations || []).filter(e => e.school);
  const eduText = eduEntries.length
    ? eduEntries.map(e => e.degree ? `${e.school} (${e.degree})` : e.school).join('\n')
    : page.education || '';

  const details = [
    { label: 'Born', value: [page.bornDate, page.bornPlace].filter(Boolean).join('\n') },
    { label: 'Died', value: [page.diedDate, page.diedPlace].filter(Boolean).join('\n') },
    { label: 'Political party', value: page.politicalParty },
    { label: 'Spouse(s)', value: page.spouses },
    { label: 'Children', value: page.children },
    { label: 'Education', value: eduText },
  ];
  const hasDetails = details.some(d => d.value);
  if (hasDetails) {
    const detailHeader = document.createElement('tr');
    const detailTd = document.createElement('td');
    detailTd.colSpan = 2;
    detailTd.style.cssText = 'text-align:center;padding:4px 4px;background:#b0c4de;font-weight:700;font-size:14px;border-bottom:none;';
    detailTd.textContent = 'Personal details';
    detailHeader.append(detailTd);
    ib.append(detailHeader);
  }
  details.forEach(d => {
    if (!d.value) return;
    const row = document.createElement('tr');
    const th = document.createElement('th');
    th.style.cssText = 'text-align:left;padding:4px 8px;font-size:14px;font-weight:700;vertical-align:top;width:40%;border-bottom:none;';
    th.textContent = d.label;
    const td = document.createElement('td');
    td.style.cssText = 'padding:4px 8px;font-size:14px;border-bottom:none;';
    if (d.value.includes('\n')) {
      d.value.split('\n').forEach((line, i) => {
        if (i > 0) td.append(document.createElement('br'));
        td.append(document.createTextNode(line));
      });
    } else {
      td.textContent = d.value;
    }
    row.append(th, td);
    ib.append(row);
  });

  // Lead paragraph
  const leadEl = section.querySelector('.wiki-lead');
  if (page.lead) {
    let leadHtml = page.lead.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    if (page.highlightWords) {
      leadHtml = applyHighlightWords(leadHtml, page.highlightWords);
    }
    // Bold the first occurrence of the person's name
    const nameEsc = page.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    leadHtml = leadHtml.replace(new RegExp(nameEsc), `<b>${page.name.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</b>`);
    leadEl.innerHTML = `<p style="font-size:14px;line-height:1.6">${leadHtml}</p>`;
    leadEl.hidden = false;
  } else {
    leadEl.hidden = true;
  }

  // TOC
  const tocEl = section.querySelector('.wiki-toc');
  const sections = page.sections || [];
  if (sections.length > 1) {
    tocEl.innerHTML = '<div class="wiki-toc-title">Contents</div>';
    const ol = document.createElement('ol');
    ol.className = 'wiki-toc-list';
    sections.forEach((s, i) => {
      if (!s.heading) return;
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#wiki-sec-${i}`;
      a.textContent = s.heading;
      a.style.cssText = 'color:#0645ad;text-decoration:none;';
      li.append(a);
      ol.append(li);
    });
    tocEl.append(ol);
    tocEl.hidden = false;
  } else {
    tocEl.hidden = true;
  }

  // Content sections
  const sectionsDiv = section.querySelector('.wiki-sections');
  sectionsDiv.innerHTML = '';
  sections.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'wiki-section';
    div.id = `wiki-sec-${i}`;
    if (s.heading) {
      const h = document.createElement('h2');
      h.className = 'wiki-section-heading';
      h.textContent = s.heading;
      div.append(h);
    }
    if (s.text) {
      let textHtml = s.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      if (page.highlightWords) textHtml = applyHighlightWords(textHtml, page.highlightWords);
      textHtml = textHtml.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>');
      const p = document.createElement('div');
      p.innerHTML = `<p>${textHtml}</p>`;
      div.append(p);
    }
    sectionsDiv.append(div);
  });

  // Hide election-specific elements
  section.querySelector('.wiki-nominee-gallery').innerHTML = '';
  section.querySelector('.wiki-election-nav').hidden = true;
  section.querySelector('.wiki-ec-info').hidden = true;
  section.querySelector('.wiki-map').hidden = true;
  section.querySelector('.wiki-map-caption').hidden = true;
  section.querySelector('.wiki-president-info').hidden = true;
  section.querySelector('.wiki-turnout-row').hidden = true;
  section.querySelector('.wiki-candidate-table').hidden = true;
}

function renderTemplatePage(templates, hash) {
  const section = document.getElementById('wiki');
  if (!section) return;
  if (!hash.startsWith('tpl-')) return;
  const slug = hash.slice('tpl-'.length);
  const page = templates[slug];
  if (!page || !page.title) {
    section.querySelector('.wiki-body').innerHTML = '<p>Page not found.</p>';
    return;
  }

  const title = section.querySelector('.wiki-title');
  title.textContent = page.title;

  // Sidebar image (use infobox-wrap area)
  const infoboxWrap = section.querySelector('.wiki-infobox-wrap');
  if (page.sidebarImage) {
    infoboxWrap.hidden = false;
    infoboxWrap.style.width = '';
    const ib = section.querySelector('.wiki-person-infobox');
    ib.innerHTML = '';
    const imgRow = document.createElement('tr');
    const imgTd = document.createElement('td');
    imgTd.colSpan = 2;
    imgTd.style.cssText = 'text-align:center;padding:8px;border-bottom:none;';
    const img = document.createElement('img');
    img.src = page.sidebarImage;
    img.alt = page.title;
    img.style.cssText = 'width:250px;max-width:100%;';
    imgTd.append(img);
    if (page.sidebarCaption) {
      const cap = document.createElement('div');
      cap.style.cssText = 'font-size:12px;color:#54595d;margin-top:4px;';
      cap.textContent = page.sidebarCaption;
      imgTd.append(cap);
    }
    imgRow.append(imgTd);
    ib.append(imgRow);
  } else {
    infoboxWrap.hidden = true;
    section.querySelector('.wiki-person-infobox').innerHTML = '';
  }

  // Lead paragraph
  const leadEl = section.querySelector('.wiki-lead');
  if (page.lead) {
    let leadHtml = page.lead.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    if (page.highlightWords) leadHtml = applyHighlightWords(leadHtml, page.highlightWords);
    leadHtml = leadHtml.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>');
    leadEl.innerHTML = `<p style="font-size:14px;line-height:1.6">${leadHtml}</p>`;
    leadEl.hidden = false;
  } else {
    leadEl.hidden = true;
  }

  const esc = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const columns = page.columns || [];
  const rows = page.rows || [];
  const sectionsDiv = section.querySelector('.wiki-sections');
  sectionsDiv.innerHTML = '';

  if (columns.length && rows.length) {
    const tableHeading = document.createElement('h2');
    tableHeading.className = 'wiki-section-heading';
    tableHeading.id = 'tpl-table';
    tableHeading.textContent = page.title;
    sectionsDiv.append(tableHeading);

    const table = document.createElement('table');
    table.className = 'tpl-wiki-table';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    columns.forEach(c => {
      if (c.type === 'color-bar') return;
      const th = document.createElement('th');
      th.dataset.col = c.key;
      th.textContent = c.label || c.key;
      if (c.width) th.style.width = c.width;
      headerRow.append(th);
    });
    thead.append(headerRow);
    table.append(thead);

    const colorBarMap = {};
    const colorBarSameKey = new Set();
    columns.forEach((c, i) => {
      if (c.type === 'color-bar' && columns[i + 1]) {
        colorBarMap[columns[i + 1].key] = c.key;
        if (c.key === columns[i + 1].key) colorBarSameKey.add(c.key);
      }
    });

    const isNameCol = k => { const lk = (k || '').toLowerCase(); return lk.includes('name') || lk.includes('president'); };
    const isTermCol = k => (k || '').toLowerCase().includes('term');
    const nameToSlug = n => n.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    const tbody = document.createElement('tbody');
    rows.forEach(r => {
      const multiCols = columns.filter(c => c.multi);
      const maxMulti = Math.max(1, ...multiCols.map(c => { const v = r[c.key] || ''; return v.includes(';') ? v.split(';').length : 1; }));

      for (let subRow = 0; subRow < maxMulti; subRow++) {
        const tr = document.createElement('tr');
        columns.forEach(c => {
          if (c.type === 'color-bar') return;
          const val = r[c.key] || '';
          const parts = val.includes(';') ? val.split(';').map(s => s.trim()) : [val];
          const barKey = colorBarMap[c.key];
          const barColor = barKey ? (r[barKey] || '') : '';

          if (!c.multi) {
            if (subRow > 0) return;
            const rs = maxMulti > 1;
            if (c.type === 'image') {
              const td = document.createElement('td');
              td.className = 'tpl-portrait-cell';
              if (rs) td.rowSpan = maxMulti;
              if (val) {
                const img = document.createElement('img');
                img.src = val;
                img.alt = '';
                img.className = 'tpl-portrait-img';
                td.append(img);
              }
              tr.append(td);
            } else {
              const td = document.createElement('td');
              td.className = 'tpl-text-cell';
              td.dataset.col = c.key;
              if (rs) td.rowSpan = maxMulti;
              if (barColor) td.style.borderLeft = `8px solid ${barColor}`;
              const suppressText = colorBarSameKey.has(c.key);

              const hl = !c.noHighlight;
              if (suppressText) {
                // color-bar and text column share the same key; color is on border, don't show hex as text
              } else if (hl && isNameCol(c.key)) {
                const nameParts = val.match(/^(.+?)\s*\((.+)\)$/);
                if (nameParts) {
                  const slug = nameToSlug(nameParts[1]);
                  let nameHtml = esc(nameParts[1]);
                  if (page.highlightWords) nameHtml = applyHighlightWords(nameHtml, page.highlightWords);
                  td.innerHTML = `<a class="tpl-name-link" href="/#wiki-${slug}">${nameHtml}</a><div class="tpl-birth-death">(${esc(nameParts[2])})</div>`;
                } else {
                  const slug = nameToSlug(val);
                  let nameHtml = esc(val);
                  if (page.highlightWords) nameHtml = applyHighlightWords(nameHtml, page.highlightWords);
                  td.innerHTML = `<a class="tpl-name-link" href="/#wiki-${slug}">${nameHtml}</a>`;
                }
              } else if (isTermCol(c.key)) {
                const termParts = val.split(/\s*[-–]\s*/);
                if (termParts.length === 2) {
                  let t0 = esc(termParts[0]), t1 = esc(termParts[1]);
                  if (hl && page.highlightWords) { t0 = applyHighlightWords(t0, page.highlightWords); t1 = applyHighlightWords(t1, page.highlightWords); }
                  td.innerHTML = `<div>${t0}</div><div class="tpl-term-dash">–</div><div>${t1}</div>`;
                } else {
                  let termHtml = esc(val);
                  if (hl && page.highlightWords) termHtml = applyHighlightWords(termHtml, page.highlightWords);
                  td.innerHTML = termHtml;
                }
              } else {
                let textHtml = esc(val);
                if (hl && page.highlightWords) textHtml = applyHighlightWords(textHtml, page.highlightWords);
                td.innerHTML = textHtml;
              }
              tr.append(td);
            }
          } else {
            const singleMulti = parts.length === 1 && maxMulti > 1;
            if (singleMulti && subRow > 0) return;
            const td = document.createElement('td');
            td.className = 'tpl-text-cell';
            td.dataset.col = c.key;
            if (singleMulti) td.rowSpan = maxMulti;
            if (barColor) td.style.borderLeft = `8px solid ${barColor}`;
            const cellVal = parts[subRow] || '';
            const hl2 = !c.noHighlight;
            if (hl2 && isNameCol(c.key)) {
              const nameParts = cellVal.match(/^(.+?)\s*\((.+)\)$/);
              if (nameParts) {
                const slug = nameToSlug(nameParts[1]);
                let nameHtml = esc(nameParts[1]);
                if (page.highlightWords) nameHtml = applyHighlightWords(nameHtml, page.highlightWords);
                td.innerHTML = `<a class="tpl-name-link" href="/#wiki-${slug}">${nameHtml}</a><div class="tpl-birth-death">(${esc(nameParts[2])})</div>`;
              } else {
                const slug = nameToSlug(cellVal);
                let nameHtml = esc(cellVal);
                if (page.highlightWords) nameHtml = applyHighlightWords(nameHtml, page.highlightWords);
                td.innerHTML = `<a class="tpl-name-link" href="/#wiki-${slug}">${nameHtml}</a>`;
              }
            } else {
              let textHtml = esc(cellVal);
              if (hl2 && page.highlightWords) textHtml = applyHighlightWords(textHtml, page.highlightWords);
              td.innerHTML = textHtml;
            }
            tr.append(td);
          }
        });
        tbody.append(tr);
      }
    });
    table.append(tbody);
    sectionsDiv.append(table);
  }

  // TOC
  const allSections = page.sections || [];
  const tocEl = section.querySelector('.wiki-toc');
  const tocItems = [
    ...(columns.length && rows.length ? [{ heading: page.title, id: 'tpl-table' }] : []),
    ...allSections.map((s, i) => ({ heading: s.heading, id: `tpl-sec-${i}` })),
  ];
  if (tocItems.length > 1) {
    tocEl.innerHTML = '<div class="wiki-toc-title">Contents</div>';
    const ol = document.createElement('ol');
    ol.className = 'wiki-toc-list';
    tocItems.forEach(item => {
      if (!item.heading) return;
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${item.id}`;
      a.textContent = item.heading;
      a.style.cssText = 'color:#0645ad;text-decoration:none;';
      a.addEventListener('click', e => {
        e.preventDefault();
        document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' });
      });
      li.append(a);
      ol.append(li);
    });
    tocEl.append(ol);
    tocEl.hidden = false;
  } else {
    tocEl.hidden = true;
  }

  // Additional sections
  allSections.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'wiki-section';
    div.id = `tpl-sec-${i}`;
    if (s.heading) {
      const h = document.createElement('h2');
      h.className = 'wiki-section-heading';
      h.textContent = s.heading;
      div.append(h);
    }
    if (s.text) {
      let textHtml = s.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      if (page.highlightWords) textHtml = applyHighlightWords(textHtml, page.highlightWords);
      textHtml = textHtml.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>');
      const p = document.createElement('div');
      p.innerHTML = `<p>${textHtml}</p>`;
      div.append(p);
    }
    sectionsDiv.append(div);
  });

  // Hide election-specific elements
  section.querySelector('.wiki-nominee-gallery').innerHTML = '';
  section.querySelector('.wiki-election-nav').hidden = true;
  section.querySelector('.wiki-ec-info').hidden = true;
  section.querySelector('.wiki-map').hidden = true;
  section.querySelector('.wiki-map-caption').hidden = true;
  section.querySelector('.wiki-president-info').hidden = true;
  section.querySelector('.wiki-turnout-row').hidden = true;
  section.querySelector('.wiki-candidate-table').hidden = true;
}

fetch('/api/content')
  .then(res => res.json())
  .then(content => {
    renderHome(content.home);
    renderContact(content.contact);
    renderArt(content.art || []);
    window._clipData = content.clips || [];
    renderClips(window._clipData);
    window._electionsData = content.elections || {};
    window._censusData = content.censusData || {};
    window._wikiPages = content.wikiPages || {};
    window._templatePages = content.templatePages || {};
    window._highlightLinks = content.highlightLinks || {};
    renderElectionPage(window._electionsData, location.hash.slice(1));
    const h = location.hash.slice(1);
    if (h.startsWith('tpl-')) renderTemplatePage(window._templatePages, h);
    else if (h.startsWith('wiki-')) renderWikiPage(window._wikiPages, h);
    else if (h === 'wiki' || h === '' || !h.startsWith('election-')) renderWikiIndex(window._wikiPages, window._electionsData, window._templatePages);
    if (content.fc) fcData = content.fc;
    renderFc();
    renderBeats(content.beats, content.producers);
  });
