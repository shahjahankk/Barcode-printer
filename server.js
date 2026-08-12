require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { getPool } = require('./db');

const authRoutes = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const labelsRoutes = require('./routes/labels');

const app = express();
const PORT = process.env.PORT || 5055;
const publicDir = path.join(__dirname, 'public');
const assetsDir = path.join(publicDir, 'assets');

function sendPublic(res, fileName) {
  const full = path.join(publicDir, fileName);
  if (!fs.existsSync(full)) {
    return res.status(500).type('html').send(`<!doctype html><html><body style="font-family:sans-serif;padding:24px">
<h1>LabelPress UI missing</h1>
<p>Upload/commit the <code>public/</code> folder (built UI), then Restart.</p>
<p><a href="/api/health">/api/health</a></p>
</body></html>`);
  }
  res.type('html');
  return res.sendFile(full);
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
    return 'application/javascript; charset=utf-8';
  }
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.woff2') return 'font/woff2';
  if (ext === '.woff') return 'font/woff';
  return null;
}

function sendAsset(res, absolutePath) {
  if (!fs.existsSync(absolutePath)) {
    return res.status(404).type('text').send('Not found');
  }
  // Buffer + explicit type (sendFile often becomes octet-stream on LiteSpeed/cPanel)
  const type = contentTypeFor(absolutePath) || 'application/octet-stream';
  const body = fs.readFileSync(absolutePath);
  res.status(200);
  res.setHeader('Content-Type', type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Content-Length', String(body.length));
  return res.end(body);
}

// Never block listen on DB — same pattern as Queue Management / Laboratory
getPool()
  .query('SELECT 1')
  .then(() => console.log('MySQL connected:', process.env.DB_NAME || 'petzonep_barcode_printer'))
  .catch((err) => console.error('MySQL connection failed:', err.message));

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

const configuredCorsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (
      !origin ||
      configuredCorsOrigins.length === 0 ||
      configuredCorsOrigins.includes('*') ||
      configuredCorsOrigins.includes(origin) ||
      /^https:\/\/([a-z0-9-]+\.)*petzone\.pk$/i.test(origin) ||
      /^http:\/\/localhost(?::\d+)?$/i.test(origin)
    ) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
}));

app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));

async function healthHandler(req, res) {
  let db = 'down';
  let dbError = null;
  try {
    await getPool().query('SELECT 1 AS ok');
    db = 'up';
  } catch (err) {
    dbError = err.message;
  }

  const indexOk = fs.existsSync(path.join(publicDir, 'index.html'));
  const assetsOk = fs.existsSync(assetsDir);
  let sampleJs = null;
  if (assetsOk) {
    const js = fs.readdirSync(assetsDir).find((f) => f.endsWith('.js'));
    sampleJs = js || null;
  }
  const ok = db === 'up' && indexOk;

  res.status(ok ? 200 : 503).json({
    success: ok,
    service: 'PetZone LabelPress',
    time: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    node: process.version,
    database: db,
    ...(dbError ? { dbError } : {}),
    files: {
      index: indexOk,
      assets: assetsOk,
      sampleJs,
    },
    assetsVia: '/api/static/*',
  });
}

app.get('/api/health', healthHandler);
app.get('/health', healthHandler);

app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/labels', labelsRoutes);

// Explicit asset routes with forced MIME (cPanel often serves .js as octet-stream)
app.get('/api/static/assets/:file', (req, res) => {
  const name = path.basename(String(req.params.file || ''));
  if (!name || name !== req.params.file) return res.status(400).end();
  return sendAsset(res, path.join(assetsDir, name));
});

app.get('/api/static/:file', (req, res, next) => {
  const name = path.basename(String(req.params.file || ''));
  if (!name || name !== req.params.file || name === 'assets') return next();
  return sendAsset(res, path.join(publicDir, name));
});

app.use(
  '/api/static',
  express.static(publicDir, {
    index: false,
    maxAge: '1h',
    setHeaders(res, filePath) {
      const type = contentTypeFor(filePath);
      if (type) res.setHeader('Content-Type', type);
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  }),
);

app.get('/', (req, res) => sendPublic(res, 'index.html'));

// SPA fallback (SSO query string, deep links) — never steal /api/*
app.get(/^\/(?!api\/).*/, (req, res, next) => {
  if (path.extname(req.path)) return next();
  return sendPublic(res, 'index.html');
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return;
  res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

app.listen(PORT, () => {
  console.log(`PetZone LabelPress running on port ${PORT}`);
});

module.exports = app;
