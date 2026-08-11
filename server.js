require('dotenv').config()

const path = require('path')
const fs = require('fs')
const express = require('express')
const cors = require('cors')
const { getPool } = require('./db')

const authRoutes = require('./routes/auth')
const settingsRoutes = require('./routes/settings')
const labelsRoutes = require('./routes/labels')

const app = express()
const PORT = process.env.PORT || 5055
const distDir = path.join(__dirname, 'dist')
const indexHtml = path.join(distDir, 'index.html')
const hasUi = fs.existsSync(indexHtml)

getPool()
  .query('SELECT 1')
  .then(() => console.log('MySQL connected:', process.env.DB_NAME || 'petzonep_barcode_labelpress'))
  .catch((err) => console.error('MySQL connection failed:', err.message))

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    service: 'barcode-printer',
    ui: hasUi,
    db: process.env.DB_NAME || null,
    timestamp: new Date().toISOString(),
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/labels', labelsRoutes)

if (hasUi) {
  app.use(express.static(distDir))
  app.get('/', (req, res) => res.sendFile(indexHtml))
  app.get(/^\/(?!api\/).*/, (req, res, next) => {
    if (path.extname(req.path)) return next()
    res.sendFile(indexHtml)
  })
} else {
  app.get('/', (req, res) => {
    res.type('html').send(`<!doctype html><html><body style="font-family:sans-serif;padding:24px">
<h1>LabelPress API is running</h1>
<p>UI build missing. In cPanel run JS script <code>build</code>, then Restart.</p>
<p><a href="/api/health">/api/health</a></p>
</body></html>`)
  })
}

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` })
})

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ success: false, message: err.message || 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`LabelPress on :${PORT} — UI ${hasUi ? 'ready' : 'run npm run build'}`)
})

module.exports = app
