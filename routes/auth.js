const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const express = require('express')
const { query } = require('../db')
const { signToken } = require('../middleware/auth')

const router = express.Router()

function mapRoleFromPos(posRole) {
  const r = String(posRole || '').toUpperCase()
  if (r === 'ADMIN') return 'admin'
  if (r === 'WAREHOUSE_KEEPER' || r === 'WAREHOUSE') return 'warehouse'
  return 'operator'
}

async function ensureUserSettings(userId) {
  await query(
    `INSERT IGNORE INTO bp_settings (user_id, next_sku, width_in, height_in)
     VALUES (:userId, 1001, 2.20, 1.00)`,
    { userId }
  )
}

async function findOrCreatePosUser(posUsername, posRole) {
  const username = String(posUsername || 'pos-user').trim().slice(0, 64) || 'pos-user'
  const role = mapRoleFromPos(posRole)
  const rows = await query(
    `SELECT id, username, role, is_active FROM bp_users WHERE username = :username LIMIT 1`,
    { username }
  )
  if (rows.length) {
    const user = rows[0]
    if (!user.is_active) {
      const err = new Error('Barcode user is inactive')
      err.status = 403
      throw err
    }
    if (user.role !== role) {
      await query(`UPDATE bp_users SET role = :role WHERE id = :id`, { role, id: user.id })
      user.role = role
    }
    await ensureUserSettings(user.id)
    return user
  }

  const randomPass = crypto.randomBytes(24).toString('hex')
  const passwordHash = await bcrypt.hash(randomPass, 10)
  const result = await query(
    `INSERT INTO bp_users (username, password_hash, role, is_active)
     VALUES (:username, :passwordHash, :role, 1)`,
    { username, passwordHash, role }
  )
  const user = { id: result.insertId, username, role, is_active: 1 }
  await ensureUserSettings(user.id)
  return user
}

router.post('/login', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim()
    const password = String(req.body?.password || '')
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' })
    }

    const rows = await query(
      `SELECT id, username, password_hash, role, is_active
       FROM bp_users WHERE username = :username LIMIT 1`,
      { username }
    )
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' })
    }
    const user = rows[0]
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account inactive' })
    }
    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' })
    }

    await ensureUserSettings(user.id)
    const token = signToken(user)
    return res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, role: user.role },
    })
  } catch (err) {
    console.error('login error', err)
    return res.status(500).json({ success: false, message: 'Login failed' })
  }
})

/**
 * Called by POS backend with shared secret — mints one-time SSO token.
 * Body: { posUsername, posRole }
 * Header: x-barcode-sso-secret
 */
router.post('/sso/mint', async (req, res) => {
  try {
    const secret = req.headers['x-barcode-sso-secret']
    const expected =
      process.env.SSO_SHARED_SECRET || 'petzone-barcode-sso-shared-secret'
    if (!secret || secret !== expected) {
      return res.status(401).json({ success: false, message: 'Invalid SSO secret' })
    }

    const posUsername = String(req.body?.posUsername || '').trim()
    const posRole = String(req.body?.posRole || '').trim()
    if (!posUsername) {
      return res.status(400).json({ success: false, message: 'posUsername required' })
    }

    const user = await findOrCreatePosUser(posUsername, posRole)
    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

    await query(
      `INSERT INTO bp_sso_tokens (token_hash, user_id, pos_username, pos_role, expires_at)
       VALUES (:tokenHash, :userId, :posUsername, :posRole, DATE_ADD(NOW(), INTERVAL 2 MINUTE))`,
      {
        tokenHash,
        userId: user.id,
        posUsername,
        posRole: posRole || null,
      }
    )

    const appUrl = (process.env.BARCODE_APP_URL || 'https://barcode-printer.petzone.pk').replace(
  /\/$/,
  '',
)
    const ssoUrl = appUrl ? `${appUrl}/?sso=${encodeURIComponent(rawToken)}` : null

    return res.json({
      success: true,
      ssoToken: rawToken,
      expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      ssoUrl,
      user: { id: user.id, username: user.username, role: user.role },
    })
  } catch (err) {
    console.error('sso mint error', err)
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'SSO mint failed',
    })
  }
})

/** Frontend exchanges one-time SSO token for JWT */
router.post('/sso/exchange', async (req, res) => {
  try {
    const rawToken = String(req.body?.ssoToken || req.body?.token || '').trim()
    if (!rawToken) {
      return res.status(400).json({ success: false, message: 'ssoToken required' })
    }
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const rows = await query(
      `SELECT t.id, t.user_id, t.expires_at, t.used_at, u.username, u.role, u.is_active
       FROM bp_sso_tokens t
       JOIN bp_users u ON u.id = t.user_id
       WHERE t.token_hash = :tokenHash
       LIMIT 1`,
      { tokenHash }
    )
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid SSO token' })
    }
    const row = rows[0]
    if (row.used_at) {
      return res.status(401).json({ success: false, message: 'SSO token already used' })
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return res.status(401).json({ success: false, message: 'SSO token expired' })
    }
    if (!row.is_active) {
      return res.status(403).json({ success: false, message: 'Account inactive' })
    }

    await query(`UPDATE bp_sso_tokens SET used_at = NOW() WHERE id = :id`, { id: row.id })
    await ensureUserSettings(row.user_id)

    const user = { id: row.user_id, username: row.username, role: row.role }
    const token = signToken(user)
    return res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, role: user.role },
    })
  } catch (err) {
    console.error('sso exchange error', err)
    return res.status(500).json({ success: false, message: 'SSO exchange failed' })
  }
})

module.exports = router
