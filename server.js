const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');

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

const app = express();
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: false }));

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

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ch08 running on port ${PORT}`);
});
