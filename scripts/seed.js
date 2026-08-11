/**
 * Create / reset default admin user for LabelPress API.
 * Usage: npm run seed
 * Env: SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD
 */
require('dotenv').config()
const bcrypt = require('bcryptjs')
const { query, getPool } = require('../db')

async function seed() {
  const username = String(process.env.SEED_ADMIN_USERNAME || 'admin').trim()
  const password = String(process.env.SEED_ADMIN_PASSWORD || '').trim()
  if (!password || password.length < 6) {
    console.error('Set SEED_ADMIN_PASSWORD in .env (min 6 chars) before seeding.')
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const existing = await query(
    `SELECT id FROM bp_users WHERE username = :username LIMIT 1`,
    { username }
  )

  let userId
  if (existing.length) {
    userId = existing[0].id
    await query(
      `UPDATE bp_users SET password_hash = :passwordHash, role = 'admin', is_active = 1 WHERE id = :id`,
      { passwordHash, id: userId }
    )
    console.log(`Updated admin user: ${username}`)
  } else {
    const result = await query(
      `INSERT INTO bp_users (username, password_hash, role, is_active)
       VALUES (:username, :passwordHash, 'admin', 1)`,
      { username, passwordHash }
    )
    userId = result.insertId
    console.log(`Created admin user: ${username}`)
  }

  await query(
    `INSERT IGNORE INTO bp_settings (user_id, next_sku, width_in, height_in)
     VALUES (:userId, 1001, 2.20, 1.00)`,
    { userId }
  )

  await getPool().end()
  console.log('Seed complete. Change the password after first login.')
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
