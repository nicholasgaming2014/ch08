const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const express = require('express');
const multer = require('multer');
const FC_SCHEMA = require('./public/fc-schema.js');

// Load a local .env file when there is one (Render sets env vars directly).
try { process.loadEnvFile(); } catch {}

const PORT = process.env.PORT || 3000;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
// Without SESSION_SECRET, a random one is used and logins reset on every restart.
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_HOURS = 12;
const COOKIE = 'ch08_admin';

const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const failures = new Map();

// Uploads and page content live here. On Render, point DATA_DIR at the persistent disk.
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const DEFAULT_CONTENT = {
  home: { headline: '', bigText: '', paragraph: '', links: [], collageGifs: ['/assets/jeff-teague-5150.gif'] },
  homePresets: [],
  contact: { email: '', paragraph: '', socials: [] },
  beats: [],
  // Producer pictures for the beats page pills, keyed by lowercase producer name.
  producers: {},
  // Artwork for the art page collage, newest first.
  art: [],
  // Stat rows for the fc/fifa page, one list per table in FC_SCHEMA.
  fc: Object.fromEntries(Object.keys(FC_SCHEMA).map(table => [table, []])),
  clips: [],
  elections: {},
  censusData: {},
  wikiPages: {},
  highlightLinks: {},
};

const CENSUS_2020 = {AL:9,AK:3,AZ:11,AR:6,CA:54,CO:10,CT:7,DE:3,FL:30,GA:16,HI:4,ID:4,IL:19,IN:11,IA:6,KS:6,KY:8,LA:8,ME:4,MD:10,MA:11,MI:15,MN:10,MS:6,MO:10,MT:4,NE:5,NV:6,NH:4,NJ:14,NM:5,NY:28,NC:16,ND:3,OH:17,OK:7,OR:8,PA:19,RI:4,SC:9,SD:3,TN:11,TX:40,UT:6,VT:3,VA:13,WA:12,WV:4,WI:10,WY:3,DC:3};

function defaultElection() {
  return {
    title: '', lead: '', highlightWords: '', infobox: '', electionDate: '',
    turnout: '', turnoutChange: '', mapImage: '', mapCaption: '',
    presidentBefore: '', presidentBeforeParty: '',
    electedPresident: '', electedPresidentParty: '',
    stateColors: {}, candidates: [], sections: [],
  };
}

function loadElection(saved) {
  const e = defaultElection();
  if (saved && typeof saved === 'object') {
    Object.assign(e, saved);
    if (!Array.isArray(e.candidates)) e.candidates = [];
    if (!Array.isArray(e.sections)) e.sections = [];
    if (!e.stateColors || typeof e.stateColors !== 'object') e.stateColors = {};
  }
  return e;
}

// Beats saved before multiple producers had a single `producer` string.
function withProducerList(beat) {
  if (Array.isArray(beat.producers)) return beat;
  const { producer, ...rest } = beat;
  return { ...rest, producers: producer ? [producer] : [] };
}

function loadContent() {
  const content = structuredClone(DEFAULT_CONTENT);
  try {
    const saved = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
    Object.assign(content.home, saved.home);
    if (!Array.isArray(content.home.collageGifs)) {
      content.home.collageGifs = content.home.image ? [content.home.image] : [];
    }
    delete content.home.image;
    if (Array.isArray(saved.homePresets)) content.homePresets = saved.homePresets;
    Object.assign(content.contact, saved.contact);
    if (Array.isArray(saved.beats)) content.beats = saved.beats.map(withProducerList);
    if (saved.producers && typeof saved.producers === 'object') content.producers = saved.producers;
    if (Array.isArray(saved.art)) content.art = saved.art;
    Object.keys(FC_SCHEMA).forEach(table => {
      if (Array.isArray(saved.fc?.[table])) content.fc[table] = saved.fc[table];
    });
    if (Array.isArray(saved.clips)) content.clips = saved.clips;
    // Migrate old single election → elections map
    if (saved.elections && typeof saved.elections === 'object') {
      for (const [slug, e] of Object.entries(saved.elections)) {
        content.elections[slug] = loadElection(e);
      }
    } else if (saved.election && typeof saved.election === 'object' && saved.election.title) {
      const slug = (saved.election.title.match(/\d{4}/) || ['default'])[0];
      content.elections[slug] = loadElection(saved.election);
    }
    if (saved.censusData && typeof saved.censusData === 'object') {
      for (const [year, data] of Object.entries(saved.censusData)) {
        if (data && typeof data === 'object') content.censusData[year] = data;
      }
    }
    if (saved.wikiPages && typeof saved.wikiPages === 'object') {
      for (const [slug, page] of Object.entries(saved.wikiPages)) {
        if (page && typeof page === 'object') content.wikiPages[slug] = page;
      }
    }
    if (saved.highlightLinks && typeof saved.highlightLinks === 'object') {
      content.highlightLinks = saved.highlightLinks;
    }
  } catch {}
  // Seed 2020 census if no census data exists
  if (Object.keys(content.censusData).length === 0) {
    content.censusData['2020'] = { ...CENSUS_2020 };
  }
  return content;
}

const content = loadContent();
let writing = Promise.resolve();

// Writes are queued and atomic so a crash mid-write can't corrupt content.json.
function saveContent() {
  const data = JSON.stringify(content, null, 2);
  writing = writing.catch(() => {}).then(async () => {
    const tmp = CONTENT_FILE + '.tmp';
    await fsp.writeFile(tmp, data);
    await fsp.rename(tmp, CONTENT_FILE);
  });
  return writing;
}

const AUDIO_TYPES = {
  'audio/mpeg': '.mp3', 'audio/mp3': '.mp3',
  'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/wave': '.wav', 'audio/vnd.wave': '.wav',
  'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/aac': '.aac',
  'audio/ogg': '.ogg', 'audio/flac': '.flac', 'audio/x-flac': '.flac',
};
const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp' };
const VIDEO_TYPES = { 'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm' };
const SONG_COVER_FIELD = /^songCover_\d{1,2}$/;

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = AUDIO_TYPES[file.mimetype] || IMAGE_TYPES[file.mimetype];
      cb(null, crypto.randomBytes(12).toString('hex') + ext);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024, files: 40 },
  fileFilter: (req, file, cb) => {
    const isImage = ['image', 'cover', 'images', 'screenshot', 'photo', 'collageGifs', 'mapImage', 'candidateImage'].includes(file.fieldname) || SONG_COVER_FIELD.test(file.fieldname);
    const isVideo = file.fieldname === 'video';
    const allowed = file.fieldname === 'audio' ? AUDIO_TYPES : isVideo ? VIDEO_TYPES : isImage ? IMAGE_TYPES : {};
    if (allowed[file.mimetype]) return cb(null, true);
    cb(new Error(`That file type (${file.mimetype || 'unknown'}) isn't supported.`));
  },
});

const app = express();
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: '1mb' }));

const loginPage = fs.readFileSync(path.join(__dirname, 'views/login.html'), 'utf8');

function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function readCookie(req, name) {
  const pair = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null;
}

function isLoggedIn(req) {
  const token = readCookie(req, COOKIE);
  if (!token) return false;
  const [expires, signature] = token.split('.');
  return Boolean(signature) && safeEqual(signature, sign(expires)) && Number(expires) > Date.now();
}

function renderLogin(res, error, status = 200) {
  const message = error ? `<p class="login-error">${error}</p>` : '';
  res.status(status).type('html').send(loginPage.replace('<!--ERROR-->', message));
}

function requireAdmin(req, res, next) {
  if (isLoggedIn(req)) return next();
  res.redirect('/admin/login');
}

// API calls must come from the admin page's own scripts (blocks cross-site form posts).
function requireAdminApi(req, res, next) {
  if (!isLoggedIn(req)) return res.status(401).json({ error: 'Your login expired. Log in again.' });
  if (req.get('X-Requested-With') !== 'ch08-admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

// Field cleaners: everything saved is trimmed, length-limited plain text.
const text = (value, max = 2000) => String(value ?? '').trim().slice(0, max);

function safeUrl(value) {
  const raw = text(value, 500);
  if (!raw) return '';
  if (/^mailto:[^\s]+@[^\s]+$/i.test(raw)) return raw;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : 'https://' + raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function linkList(value) {
  let list = value;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch { list = []; }
  }
  if (!Array.isArray(list)) return [];
  return list.slice(0, 30)
    .map(link => ({ label: text(link?.label, 80), url: safeUrl(link?.url) }))
    .filter(link => link.label && link.url);
}

// Cover art for a song link, looked up through the service's public oEmbed endpoint.
const OEMBED = [
  [host => host.endsWith('spotify.com'), 'https://open.spotify.com/oembed?url='],
  [host => host.endsWith('soundcloud.com'), 'https://soundcloud.com/oembed?format=json&url='],
  [host => host.endsWith('youtube.com') || host === 'youtu.be', 'https://www.youtube.com/oembed?format=json&url='],
];

async function fetchArtwork(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const endpoint = OEMBED.find(([matches]) => matches(host))?.[1];
    if (!endpoint) return '';
    const res = await fetch(endpoint + encodeURIComponent(url), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return '';
    const thumbnail = String((await res.json()).thumbnail_url || '');
    return thumbnail.startsWith('https://') ? thumbnail : '';
  } catch {
    return '';
  }
}

// Songs linked to a beat: title, artist, link, an optional uploaded cover,
// and artwork fetched from the link. Uploaded covers arrive as songCover_<n> files.
async function songList(value, req, previous = []) {
  let list = value;
  try { list = JSON.parse(list || '[]'); } catch { list = []; }
  if (!Array.isArray(list)) return [];

  const keptCovers = new Set(previous.map(s => s.cover).filter(Boolean));
  const knownArtwork = new Map(previous.filter(s => s.url && s.artwork).map(s => [s.url, s.artwork]));

  const songs = list.slice(0, 30)
    .map(song => {
      const upload = SONG_COVER_FIELD.test(song?.coverFile) ? requestFile(req, song.coverFile) : null;
      return {
        title: text(song?.title, 120),
        artist: text(song?.artist, 120),
        url: safeUrl(song?.url),
        cover: upload ? fileUrl(upload) : keptCovers.has(song?.cover) ? song.cover : '',
      };
    })
    .filter(song => song.title || song.artist);

  await Promise.all(songs.map(async song => {
    song.artwork = song.url ? knownArtwork.get(song.url) || await fetchArtwork(song.url) : '';
  }));
  return songs;
}

const producerKey = name => text(name, 120).toLowerCase();

// Producers on a beat, in the order given, without blanks or repeats.
function producerList(value) {
  let list = value;
  try { list = JSON.parse(list || '[]'); } catch { list = []; }
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  return list.map(name => text(name, 120)).filter(name => {
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10);
}


function durationValue(value) {
  const seconds = Number(value);
  return seconds > 0 && seconds < 36000 ? Math.round(seconds * 10) / 10 : null;
}

function peakList(value) {
  try {
    const peaks = JSON.parse(value || '[]');
    if (!Array.isArray(peaks)) return [];
    return peaks.slice(0, 400).map(p => Math.round(Math.min(1, Math.max(0, Number(p) || 0)) * 1000) / 1000);
  } catch {
    return [];
  }
}

function bpmValue(value) {
  const bpm = Math.round(Number(value));
  return bpm >= 1 && bpm <= 999 ? bpm : null;
}

function fileUrl(file) {
  return file ? '/uploads/' + file.filename : null;
}

async function removeUpload(url) {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return;
  await fsp.unlink(path.join(UPLOAD_DIR, path.basename(url))).catch(() => {});
}

function requestFiles(req) {
  return Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat();
}

function requestFile(req, fieldname) {
  return requestFiles(req).find(f => f.fieldname === fieldname) || null;
}

async function removeRequestFiles(req, keep = []) {
  const kept = new Set(keep.filter(Boolean));
  const unused = requestFiles(req).filter(f => !kept.has(fileUrl(f)));
  await Promise.all(unused.map(f => fsp.unlink(f.path).catch(() => {})));
}

// Uploads a beat refers to: its audio, cover, and any uploaded song covers.
function beatUploads(beat) {
  return [beat.audio, beat.cover, ...(beat.songs || []).map(s => s.cover)].filter(Boolean);
}

function findBeat(req, res) {
  const beat = content.beats.find(b => b.id === req.params.id);
  if (!beat) res.status(404).json({ error: 'Beat not found.' });
  return beat;
}

// ---------- Admin login ----------

app.get('/admin/login', (req, res) => {
  if (isLoggedIn(req)) return res.redirect('/admin');
  renderLogin(res, ADMIN_USERNAME && ADMIN_PASSWORD ? '' : 'Admin login is not set up yet.');
});

app.post('/admin/login', (req, res) => {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    return renderLogin(res, 'Admin login is not set up yet.', 503);
  }

  const record = failures.get(req.ip);
  if (record && record.count >= MAX_FAILURES && Date.now() - record.first < LOCKOUT_MS) {
    return renderLogin(res, 'Too many attempts. Try again in 15 minutes.', 429);
  }

  const { username = '', password = '' } = req.body || {};
  const userOk = safeEqual(username, ADMIN_USERNAME);
  const passOk = safeEqual(password, ADMIN_PASSWORD);

  if (!userOk || !passOk) {
    const fresh = !record || Date.now() - record.first >= LOCKOUT_MS;
    failures.set(req.ip, fresh ? { count: 1, first: Date.now() } : { ...record, count: record.count + 1 });
    return renderLogin(res, 'Wrong username or password.', 401);
  }

  failures.delete(req.ip);
  const expires = String(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  res.cookie(COOKIE, `${expires}.${sign(expires)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: SESSION_HOURS * 60 * 60 * 1000,
    path: '/',
  });
  res.redirect('/admin');
});

app.post('/admin/logout', (req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.redirect('/admin/login');
});

app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views/admin.html'));
});

// ---------- Content API ----------

app.get('/api/content', (req, res) => {
  res.set('Cache-Control', 'no-store').json(content);
});

app.put('/api/admin/home', requireAdminApi, upload.fields([{ name: 'collageGifs', maxCount: 20 }]), async (req, res) => {
  const body = req.body || {};
  const newFiles = (req.files?.collageGifs || []).map(fileUrl);
  const kept = JSON.parse(body.keptGifs || '[]').filter(u => typeof u === 'string').slice(0, 20);
  const oldGifs = content.home.collageGifs || [];

  content.home = {
    headline: text(body.headline, 200),
    bigText: text(body.bigText, 300),
    paragraph: text(body.paragraph, 5000),
    links: linkList(body.links),
    collageGifs: [...kept, ...newFiles].slice(0, 20),
  };
  await saveContent();
  const currentSet = new Set(content.home.collageGifs);
  for (const url of oldGifs) {
    if (!currentSet.has(url)) await removeUpload(url);
  }
  res.json(content);
});

// ---------- Home presets ----------

app.post('/api/admin/home-presets', requireAdminApi, async (req, res) => {
  const body = req.body || {};
  const name = text(body.name, 100);
  if (!name) return res.status(400).json({ error: 'Preset needs a name.' });
  const gifs = JSON.parse(body.gifs || '[]').filter(u => typeof u === 'string').slice(0, 20);
  content.homePresets.push({ name, gifs, createdAt: Date.now() });
  await saveContent();
  res.json(content);
});

app.delete('/api/admin/home-presets/:index', requireAdminApi, async (req, res) => {
  const idx = parseInt(req.params.index, 10);
  if (isNaN(idx) || idx < 0 || idx >= content.homePresets.length) {
    return res.status(404).json({ error: 'Preset not found.' });
  }
  content.homePresets.splice(idx, 1);
  await saveContent();
  res.json(content);
});

app.put('/api/admin/contact', requireAdminApi, async (req, res) => {
  const body = req.body || {};
  const email = text(body.email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'That email address doesn’t look right.' });
  }
  content.contact = {
    email,
    paragraph: text(body.paragraph, 5000),
    socials: linkList(body.socials),
  };
  await saveContent();
  res.json(content);
});

app.post('/api/admin/beats', requireAdminApi, upload.any(), async (req, res) => {
  const body = req.body || {};
  const audio = requestFile(req, 'audio');
  const title = text(body.title, 120);
  if (!audio || !title) {
    await removeRequestFiles(req);
    return res.status(400).json({ error: 'A beat needs an audio file and a title.' });
  }

  const beat = {
    id: crypto.randomBytes(8).toString('hex'),
    title,
    producers: producerList(body.producers),
    bpm: bpmValue(body.bpm),
    key: text(body.key, 30),
    duration: durationValue(body.duration),
    songs: await songList(body.songs, req),
    audio: fileUrl(audio),
    cover: fileUrl(requestFile(req, 'cover')),
    peaks: peakList(body.peaks),
    downloadable: body.downloadable === 'true',
    createdAt: new Date().toISOString(),
  };
  content.beats.unshift(beat);
  await saveContent();
  await removeRequestFiles(req, beatUploads(beat));
  res.status(201).json(content);
});

app.put('/api/admin/beats/:id', requireAdminApi, upload.any(), async (req, res) => {
  const beat = findBeat(req, res);
  if (!beat) return removeRequestFiles(req);

  const body = req.body || {};
  const title = text(body.title, 120);
  if (!title) {
    await removeRequestFiles(req);
    return res.status(400).json({ error: 'A beat needs a title.' });
  }

  const oldUploads = beatUploads(beat);
  const cover = requestFile(req, 'cover');
  Object.assign(beat, {
    title,
    producers: producerList(body.producers),
    bpm: bpmValue(body.bpm),
    key: text(body.key, 30),
    songs: await songList(body.songs, req, beat.songs),
    downloadable: body.downloadable === 'true',
    cover: cover ? fileUrl(cover) : body.removeCover === 'true' ? null : beat.cover,
  });
  await saveContent();

  const newUploads = beatUploads(beat);
  await removeRequestFiles(req, newUploads);
  await Promise.all(oldUploads.filter(url => !newUploads.includes(url)).map(removeUpload));
  res.json(content);
});

app.post('/api/admin/beats/:id/move', requireAdminApi, async (req, res) => {
  const index = content.beats.findIndex(b => b.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Beat not found.' });
  const target = index + (req.body?.direction === 'up' ? -1 : 1);
  if (target >= 0 && target < content.beats.length) {
    [content.beats[index], content.beats[target]] = [content.beats[target], content.beats[index]];
    await saveContent();
  }
  res.json(content);
});

app.delete('/api/admin/beats/:id', requireAdminApi, async (req, res) => {
  const beat = findBeat(req, res);
  if (!beat) return;
  content.beats = content.beats.filter(b => b !== beat);
  await saveContent();
  await Promise.all(beatUploads(beat).map(removeUpload));
  res.json(content);
});


// ---------- Art ----------

const MAX_ART_UPLOAD = 30;

function findArt(req, res) {
  const piece = content.art.find(a => a.id === req.params.id);
  if (!piece) res.status(404).json({ error: 'Artwork not found.' });
  return piece;
}

const sizeValue = value => {
  const n = Math.round(Number(value));
  return n > 0 && n < 100000 ? n : null;
};

// Uploads several images at once. `details` lines up with the files: [{ title, width, height }].
app.post('/api/admin/art', requireAdminApi, upload.array('images', MAX_ART_UPLOAD), async (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: 'Pick at least one image.' });
  let details = [];
  try { details = JSON.parse(req.body?.details || '[]'); } catch {}
  if (!Array.isArray(details)) details = [];

  const now = Date.now();
  const pieces = files.map((file, i) => ({
    id: crypto.randomBytes(8).toString('hex'),
    title: text(details[i]?.title, 200),
    image: fileUrl(file),
    width: sizeValue(details[i]?.width),
    height: sizeValue(details[i]?.height),
    createdAt: new Date(now + i).toISOString(),
  }));
  content.art.unshift(...pieces);
  await saveContent();
  res.status(201).json(content);
});

app.put('/api/admin/art/:id', requireAdminApi, async (req, res) => {
  const piece = findArt(req, res);
  if (!piece) return;
  piece.title = text(req.body?.title, 200);
  await saveContent();
  res.json(content);
});

app.post('/api/admin/art/:id/move', requireAdminApi, async (req, res) => {
  const index = content.art.findIndex(a => a.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Artwork not found.' });
  const target = index + (req.body?.direction === 'up' ? -1 : 1);
  if (target >= 0 && target < content.art.length) {
    [content.art[index], content.art[target]] = [content.art[target], content.art[index]];
    await saveContent();
  }
  res.json(content);
});

app.delete('/api/admin/art/:id', requireAdminApi, async (req, res) => {
  const piece = findArt(req, res);
  if (!piece) return;
  content.art = content.art.filter(a => a !== piece);
  await saveContent();
  await removeUpload(piece.image);
  res.json(content);
});

// ---------- fc/fifa stats ----------

function statValue(field, value) {
  const raw = String(value ?? '').trim();
  if (field.type === 'bool') return raw === 'true';
  if (field.type === 'choice') return field.options.includes(raw) ? raw : field.options[0];
  if (field.type === 'text') return text(raw, 120);
  if (raw === '') return null;
  const n = Number(raw.replace(/[%,\s]/g, ''));
  if (!Number.isFinite(n) || n < 0) return null;
  if (field.type === 'int') return n <= 100000 ? Math.round(n) : null;
  if (field.type === 'rating') return n <= 10 ? Math.round(n * 10) / 10 : null;
  if (field.type === 'pct') return n <= 100 ? Math.round(n * 10) / 10 : null;
  return null;
}

function statRow(schema, body) {
  return Object.fromEntries(schema.fields.map(field => [field.key, statValue(field, body[field.key])]));
}

function fcTable(req, res) {
  const schema = Object.hasOwn(FC_SCHEMA, req.params.table) ? FC_SCHEMA[req.params.table] : null;
  if (!schema) res.status(404).json({ error: 'Unknown stats table.' });
  return schema;
}

const screenshotUpload = upload.fields([{ name: 'screenshot', maxCount: 1 }]);

app.post('/api/admin/fc/:table', requireAdminApi, screenshotUpload, async (req, res) => {
  const schema = fcTable(req, res);
  if (!schema) return removeRequestFiles(req);
  const row = statRow(schema, req.body || {});
  if (!row[schema.required]) {
    await removeRequestFiles(req);
    const field = schema.fields.find(f => f.key === schema.required);
    return res.status(400).json({ error: `Fill in the ${field.label}.` });
  }
  const screenshot = req.files?.screenshot?.[0];
  content.fc[req.params.table].push({
    id: crypto.randomBytes(8).toString('hex'),
    ...row,
    screenshot: screenshot ? fileUrl(screenshot) : '',
  });
  await saveContent();
  res.status(201).json(content);
});

app.put('/api/admin/fc/:table/:id', requireAdminApi, screenshotUpload, async (req, res) => {
  const schema = fcTable(req, res);
  if (!schema) return removeRequestFiles(req);
  const entry = content.fc[req.params.table].find(r => r.id === req.params.id);
  if (!entry) {
    await removeRequestFiles(req);
    return res.status(404).json({ error: 'Row not found.' });
  }
  const row = statRow(schema, req.body || {});
  if (!row[schema.required]) {
    await removeRequestFiles(req);
    const field = schema.fields.find(f => f.key === schema.required);
    return res.status(400).json({ error: `Fill in the ${field.label}.` });
  }
  const oldScreenshot = entry.screenshot;
  const screenshot = req.files?.screenshot?.[0];
  Object.assign(entry, row, {
    screenshot: screenshot ? fileUrl(screenshot) : req.body?.removeScreenshot === 'true' ? '' : oldScreenshot,
  });
  await saveContent();
  if (entry.screenshot !== oldScreenshot) await removeUpload(oldScreenshot);
  res.json(content);
});

app.delete('/api/admin/fc/:table/:id', requireAdminApi, async (req, res) => {
  if (!fcTable(req, res)) return;
  const rows = content.fc[req.params.table];
  const entry = rows.find(r => r.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Row not found.' });
  content.fc[req.params.table] = rows.filter(r => r !== entry);
  await saveContent();
  await removeUpload(entry.screenshot);
  res.json(content);
});

// ---------- Clips ----------

function parseStringArray(value, max = 20, maxLen = 120) {
  let list = value;
  try { list = JSON.parse(list || '[]'); } catch { list = []; }
  if (!Array.isArray(list)) return [];
  return list.map(s => text(s, maxLen)).filter(Boolean).slice(0, max);
}

function findClip(req, res) {
  const clip = content.clips.find(c => c.id === req.params.id);
  if (!clip) res.status(404).json({ error: 'Clip not found.' });
  return clip;
}

app.post('/api/admin/clips', requireAdminApi, upload.fields([{ name: 'video', maxCount: 1 }]), async (req, res) => {
  const body = req.body || {};
  const video = req.files?.video?.[0];
  const title = text(body.title, 200);
  if (!video || !title) {
    await removeRequestFiles(req);
    return res.status(400).json({ error: 'A clip needs a video file and a title.' });
  }
  const clip = {
    id: crypto.randomBytes(8).toString('hex'),
    title,
    date: text(body.date, 20),
    people: parseStringArray(body.people),
    game: text(body.game, 120),
    video: fileUrl(video),
    duration: durationValue(body.duration),
    createdAt: new Date().toISOString(),
  };
  content.clips.unshift(clip);
  await saveContent();
  res.status(201).json(content);
});

app.put('/api/admin/clips/:id', requireAdminApi, upload.fields([{ name: 'video', maxCount: 1 }]), async (req, res) => {
  const clip = findClip(req, res);
  if (!clip) return removeRequestFiles(req);
  const body = req.body || {};
  const title = text(body.title, 200);
  if (!title) {
    await removeRequestFiles(req);
    return res.status(400).json({ error: 'A clip needs a title.' });
  }
  const newVideo = req.files?.video?.[0];
  const oldVideo = clip.video;
  Object.assign(clip, {
    title,
    date: text(body.date, 20),
    people: parseStringArray(body.people),
    game: text(body.game, 120),
    duration: durationValue(body.duration) ?? clip.duration,
  });
  if (newVideo) {
    clip.video = fileUrl(newVideo);
    await removeUpload(oldVideo);
  }
  await saveContent();
  res.json(content);
});

app.delete('/api/admin/clips/:id', requireAdminApi, async (req, res) => {
  const clip = findClip(req, res);
  if (!clip) return;
  content.clips = content.clips.filter(c => c !== clip);
  await saveContent();
  await removeUpload(clip.video);
  res.json(content);
});

// ---------- Election ----------

app.put('/api/admin/elections/:slug', requireAdminApi, upload.fields([
  { name: 'mapImage', maxCount: 1 },
  { name: 'candidateImage', maxCount: 20 },
]), async (req, res) => {
  const slug = req.params.slug.replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
  if (!slug) return res.status(400).json({ error: 'invalid slug' });
  const body = req.body || {};
  const existing = content.elections[slug] || defaultElection();
  const oldMap = existing.mapImage;
  const oldCandidateImages = (existing.candidates || []).map(c => c.image).filter(Boolean);

  let candidates = [];
  try { candidates = JSON.parse(body.candidates || '[]'); } catch {}
  if (!Array.isArray(candidates)) candidates = [];

  let sections = [];
  try { sections = JSON.parse(body.sections || '[]'); } catch {}
  if (!Array.isArray(sections)) sections = [];

  const candidateFiles = (req.files?.candidateImage || []);
  candidates = candidates.slice(0, 20).map((c, i) => {
    const file = candidateFiles.find(f => f.originalname === `candidate_${i}`);
    return {
      name: text(c.name, 200),
      party: text(c.party, 120),
      partyColor: text(c.partyColor, 20),
      homeState: text(c.homeState, 100),
      runningMate: text(c.runningMate, 200),
      electoralVotes: text(c.electoralVotes, 20),
      statesCarried: text(c.statesCarried, 100),
      popularVotes: text(c.popularVotes, 30),
      popularPct: text(c.popularPct, 20),
      image: file ? fileUrl(file) : (c.keptImage || ''),
    };
  });

  sections = sections.slice(0, 50).map(s => ({
    heading: text(s.heading, 300),
    text: text(s.text, 10000),
  }));

  let stateColors = {};
  try { stateColors = JSON.parse(body.stateColors || '{}'); } catch {}
  if (typeof stateColors !== 'object' || Array.isArray(stateColors)) stateColors = {};

  const mapFile = req.files?.mapImage?.[0];
  content.elections[slug] = {
    title: text(body.title, 300),
    lead: text(body.lead, 10000),
    highlightWords: text(body.highlightWords, 2000),
    infobox: text(body.infobox, 500),
    electionDate: text(body.electionDate, 100),
    turnout: text(body.turnout, 100),
    turnoutChange: text(body.turnoutChange, 20),
    mapImage: mapFile ? fileUrl(mapFile) : (body.keptMapImage || ''),
    mapCaption: text(body.mapCaption, 500),
    presidentBefore: text(body.presidentBefore, 200),
    presidentBeforeParty: text(body.presidentBeforeParty, 100),
    electedPresident: text(body.electedPresident, 200),
    electedPresidentParty: text(body.electedPresidentParty, 100),
    stateColors,
    candidates,
    sections,
  };
  await saveContent();

  if (oldMap && oldMap !== content.elections[slug].mapImage) await removeUpload(oldMap);
  const newImages = new Set(content.elections[slug].candidates.map(c => c.image).filter(Boolean));
  for (const url of oldCandidateImages) {
    if (!newImages.has(url)) await removeUpload(url);
  }
  await removeRequestFiles(req, [content.elections[slug].mapImage, ...newImages]);
  res.json(content);
});

app.delete('/api/admin/elections/:slug', requireAdminApi, async (req, res) => {
  const slug = req.params.slug.replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
  const election = content.elections[slug];
  if (!election) return res.status(404).json({ error: 'not found' });
  if (election.mapImage) await removeUpload(election.mapImage);
  for (const c of election.candidates || []) {
    if (c.image) await removeUpload(c.image);
  }
  delete content.elections[slug];
  await saveContent();
  res.json(content);
});

app.put('/api/admin/census/:year', requireAdminApi, express.json(), async (req, res) => {
  const year = req.params.year.replace(/\D/g, '').slice(0, 4);
  if (!year || year.length !== 4) return res.status(400).json({ error: 'invalid year' });
  const data = req.body;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return res.status(400).json({ error: 'invalid data' });
  const cleaned = {};
  for (const [state, ev] of Object.entries(data)) {
    const s = String(state).replace(/[^A-Z]/gi, '').toUpperCase().slice(0, 2);
    const n = parseInt(ev);
    if (s && !isNaN(n) && n >= 0) cleaned[s] = n;
  }
  content.censusData[year] = cleaned;
  await saveContent();
  res.json(content);
});

app.delete('/api/admin/census/:year', requireAdminApi, async (req, res) => {
  const year = req.params.year.replace(/\D/g, '').slice(0, 4);
  if (!content.censusData[year]) return res.status(404).json({ error: 'not found' });
  delete content.censusData[year];
  await saveContent();
  res.json(content);
});

// ---------- Wiki Pages ----------

app.put('/api/admin/wiki/:slug', requireAdminApi, upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'officeImage', maxCount: 10 },
]), async (req, res) => {
  const slug = req.params.slug.replace(/[^a-z0-9_-]/gi, '').toLowerCase().slice(0, 80);
  if (!slug) return res.status(400).json({ error: 'invalid slug' });
  const body = req.body || {};
  const existing = content.wikiPages[slug] || {};
  const oldPhoto = existing.photo;

  const offices = JSON.parse(body.offices || '[]').slice(0, 20).map(o => ({
    title: text(o.title, 300),
    subtitle: text(o.subtitle, 200),
    dates: text(o.dates, 200),
    fields: (o.fields || []).slice(0, 20).map(f => ({
      label: text(f.label, 100),
      value: text(f.value, 300),
    })),
  }));

  const sections = JSON.parse(body.sections || '[]').slice(0, 30).map(s => ({
    heading: text(s.heading, 300),
    text: text(s.text, 50000),
  }));

  let photo = existing.photo || '';
  if (req.files?.photo?.[0]) photo = fileUrl(req.files.photo[0]);
  else if (body.keptPhoto) photo = body.keptPhoto;
  else if (body.removePhoto === 'true') photo = '';

  content.wikiPages[slug] = {
    name: text(body.name, 300),
    photoCaption: text(body.photoCaption, 500),
    photo,
    lead: text(body.lead, 20000),
    highlightWords: text(body.highlightWords, 2000),
    bornDate: text(body.bornDate, 100),
    bornPlace: text(body.bornPlace, 300),
    politicalParty: text(body.politicalParty, 200),
    spouses: text(body.spouses, 500),
    children: text(body.children, 500),
    education: text(body.education, 1000),
    offices,
    sections,
  };
  await saveContent();
  if (oldPhoto && oldPhoto !== photo) await removeUpload(oldPhoto);
  await removeRequestFiles(req, [photo]);
  res.json(content);
});

app.delete('/api/admin/wiki/:slug', requireAdminApi, async (req, res) => {
  const slug = req.params.slug.replace(/[^a-z0-9_-]/gi, '').toLowerCase().slice(0, 80);
  const page = content.wikiPages[slug];
  if (!page) return res.status(404).json({ error: 'not found' });
  if (page.photo) await removeUpload(page.photo);
  delete content.wikiPages[slug];
  await saveContent();
  res.json(content);
});

// ---------- Highlight Links ----------

app.put('/api/admin/highlight-links', requireAdminApi, express.json(), async (req, res) => {
  const links = req.body;
  if (!links || typeof links !== 'object' || Array.isArray(links)) {
    return res.status(400).json({ error: 'expected object' });
  }
  const clean = {};
  for (const [word, url] of Object.entries(links)) {
    const w = String(word).trim().slice(0, 200);
    const u = String(url).trim().slice(0, 500);
    if (w && u) clean[w] = u;
  }
  content.highlightLinks = clean;
  await saveContent();
  res.json(content);
});

// Sets or removes one producer's picture.
app.put('/api/admin/producers/:name', requireAdminApi, upload.fields([{ name: 'image', maxCount: 1 }]), async (req, res) => {
  const key = producerKey(req.params.name);
  const image = req.files?.image?.[0];
  if (!key || key === '__proto__') {
    await removeRequestFiles(req);
    return res.status(400).json({ error: 'That producer name can’t be used.' });
  }
  const oldImage = Object.hasOwn(content.producers, key) ? content.producers[key] : undefined;
  if (image) content.producers[key] = fileUrl(image);
  else if (req.body?.remove === 'true') delete content.producers[key];
  await saveContent();
  if (content.producers[key] !== oldImage) await removeUpload(oldImage);
  res.json(content);
});

// ---------- Static files ----------

app.use('/uploads', express.static(UPLOAD_DIR, {
  setHeaders: res => res.set('X-Content-Type-Options', 'nosniff'),
}));
app.use(express.static(path.join(__dirname, 'public')));

// Upload and other errors come back as JSON the admin page can show.
app.use(async (err, req, res, next) => {
  await removeRequestFiles(req);
  const tooBig = err.code === 'LIMIT_FILE_SIZE';
  console.error(err.message);
  res.status(tooBig ? 413 : 400).json({ error: tooBig ? 'That file is too big (200 MB max).' : err.message });
});

// Songs saved before artwork lookup existed get their covers fetched once.
async function backfillArtwork() {
  const missing = content.beats.flatMap(b => b.songs || []).filter(s => s.url && s.artwork === undefined);
  if (!missing.length) return;
  await Promise.all(missing.map(async song => { song.artwork = await fetchArtwork(song.url); }));
  await saveContent();
  console.log(`Fetched artwork for ${missing.length} song(s)`);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ch08 running on port ${PORT}, saving content in ${DATA_DIR}`);
  backfillArtwork().catch(err => console.error('Artwork backfill failed:', err.message));
});
