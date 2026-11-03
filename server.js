const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const express = require('express');
const multer = require('multer');

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
  home: { headline: '', bigText: '', image: '/assets/jeff-teague-5150.gif', paragraph: '', links: [] },
  contact: { email: '', paragraph: '', socials: [] },
  beats: [],
  // Producer pictures for the beats page pills, keyed by lowercase producer name.
  producers: {},
  pedia: {
    title: '2024 United States presidential election',
    intro: 'The 2024 United States presidential election took place on November 5, 2024. [[Donald Trump]] and his running mate [[JD Vance]] defeated [[Kamala Harris]] and her running mate [[Tim Walz]], returning Trump to the White House four years after he lost to [[Joe Biden]].',
    infoboxTitle: '2024 United States presidential election',
    image: '',
    imageCaption: '',
    infobox: [
      { label: 'Election date', value: 'November 5, 2024' },
      { label: 'Electoral College', value: '538 members, 270 votes needed to win' },
      { label: 'Turnout', value: '64.3%' },
    ],
    // Two-candidate comparison in the side box, with an optional picture above each column.
    leftImage: '',
    rightImage: '',
    matchup: [
      { label: 'Nominee', left: 'Donald Trump', right: 'Kamala Harris' },
      { label: 'Party', left: 'Republican', right: 'Democratic' },
      { label: 'Home state', left: 'Florida', right: 'California' },
      { label: 'Running mate', left: 'JD Vance', right: 'Tim Walz' },
      { label: 'Electoral vote', left: '312', right: '226' },
      { label: 'States carried', left: '31 + ME-02', right: '19 + DC + NE-02' },
      { label: 'Popular vote', left: '77,302,580', right: '75,017,613' },
      { label: 'Percentage', left: '49.8%', right: '48.3%' },
    ],
    closing: [
      { label: 'President before election', value: 'Joe Biden (Democratic)' },
      { label: 'Elected president', value: 'Donald Trump (Republican)' },
    ],
    sections: [
      { heading: 'Background', body: 'Biden began the cycle as the Democratic incumbent seeking a second term, while Trump ran to return to the office he left in 2021. The race was the first in decades to open with a president and a former president as the expected nominees.' },
      { heading: 'Nominations', body: 'After a widely criticized debate performance in June, Biden ended his campaign on July 21, 2024 and endorsed Harris, his vice president. Democrats nominated her at their August convention, and she chose Walz, the governor of Minnesota. Trump won the Republican nomination after a primary season he dominated, and he picked Vance, a senator from Ohio.' },
      { heading: 'Campaign', body: 'Voters ranked the economy, inflation, immigration and abortion among their leading concerns. Trump survived an assassination attempt at a rally in Butler, Pennsylvania on July 13, and a second attempt was stopped in Florida in September.' },
      { heading: 'Results', body: 'Trump won all seven of the closely watched swing states and carried the Electoral College 312 to 226. He also won the national popular vote, becoming the first Republican to do so since 2004. He took office for his second term on January 20, 2025.' },
    ],
  },
};

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
    Object.assign(content.contact, saved.contact);
    if (Array.isArray(saved.beats)) content.beats = saved.beats.map(withProducerList);
    if (saved.producers && typeof saved.producers === 'object') content.producers = saved.producers;
    Object.assign(content.pedia, saved.pedia);
  } catch {}
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
    const isImage = ['image', 'cover', 'leftImage', 'rightImage'].includes(file.fieldname) || SONG_COVER_FIELD.test(file.fieldname);
    const allowed = file.fieldname === 'audio' ? AUDIO_TYPES : isImage ? IMAGE_TYPES : {};
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

// Rows for the ch08pedia side box.
function infoboxRows(value) {
  let list = value;
  try { list = JSON.parse(list || '[]'); } catch { list = []; }
  if (!Array.isArray(list)) return [];
  return list.slice(0, 40)
    .map(row => ({ label: text(row?.label, 120), value: text(row?.value, 500) }))
    .filter(row => row.label || row.value);
}

function matchupRows(value) {
  let list = value;
  try { list = JSON.parse(list || '[]'); } catch { list = []; }
  if (!Array.isArray(list)) return [];
  return list.slice(0, 40)
    .map(row => ({ label: text(row?.label, 120), left: text(row?.left, 200), right: text(row?.right, 200) }))
    .filter(row => row.label || row.left || row.right);
}

function pediaSections(value) {
  let list = value;
  try { list = JSON.parse(list || '[]'); } catch { list = []; }
  if (!Array.isArray(list)) return [];
  return list.slice(0, 100)
    .map(section => ({ heading: text(section?.heading, 200), body: text(section?.body, 50000) }))
    .filter(section => section.heading || section.body);
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

app.put('/api/admin/home', requireAdminApi, upload.fields([{ name: 'image', maxCount: 1 }]), async (req, res) => {
  const body = req.body || {};
  const image = req.files?.image?.[0];
  const oldImage = content.home.image;

  content.home = {
    headline: text(body.headline, 200),
    bigText: text(body.bigText, 300),
    paragraph: text(body.paragraph, 5000),
    links: linkList(body.links),
    image: image ? fileUrl(image) : body.removeImage === 'true' ? '' : oldImage,
  };
  await saveContent();
  if (content.home.image !== oldImage) await removeUpload(oldImage);
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

const PEDIA_IMAGES = [['image', 'removeImage'], ['leftImage', 'removeLeftImage'], ['rightImage', 'removeRightImage']];

app.put('/api/admin/pedia', requireAdminApi, upload.fields(PEDIA_IMAGES.map(([name]) => ({ name, maxCount: 1 }))), async (req, res) => {
  const body = req.body || {};
  const old = content.pedia;
  const images = Object.fromEntries(PEDIA_IMAGES.map(([name, remove]) => {
    const file = req.files?.[name]?.[0];
    return [name, file ? fileUrl(file) : body[remove] === 'true' ? '' : old[name]];
  }));

  content.pedia = {
    title: text(body.title, 200),
    intro: text(body.intro, 20000),
    infoboxTitle: text(body.infoboxTitle, 200),
    imageCaption: text(body.imageCaption, 300),
    infobox: infoboxRows(body.infobox),
    matchup: matchupRows(body.matchup),
    closing: infoboxRows(body.closing),
    sections: pediaSections(body.sections),
    ...images,
  };
  await saveContent();
  await Promise.all(PEDIA_IMAGES.filter(([name]) => images[name] !== old[name]).map(([name]) => removeUpload(old[name])));
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
