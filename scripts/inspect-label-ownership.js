/**
 * Copy all unique admin-owned LabelPress labels to Hyderabad Warehouse's
 * LabelPress user without replacing existing labels.
 *
 * Usage: node scripts/inspect-label-ownership.js
 */
require('dotenv').config()
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const mysql = require('mysql2/promise')

const TARGET_USERNAME = 'Dawood'

;(async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout: 20000,
  })

  try {
    await connection.beginTransaction()

    const [adminLabels] = await connection.execute(`
      SELECT l.product_name, l.price, l.code, l.format, l.width_in, l.height_in,
             l.inventory_item_id
      FROM bp_labels l
      JOIN bp_users u ON u.id = l.user_id
      WHERE u.role = 'admin' AND u.is_active = 1
      ORDER BY l.sort_order ASC, l.id ASC
    `)

    // The barcode value identifies a label. Keep the first admin copy where
    // multiple admin accounts contain the same barcode.
    const uniqueAdminLabels = [
      ...new Map(
        adminLabels
          .filter((label) => String(label.code || '').trim())
          .map((label) => [String(label.code).trim(), label]),
      ).values(),
    ]

    let [targetRows] = await connection.execute(
      `SELECT id FROM bp_users
       WHERE LOWER(username) = LOWER(?) AND role = 'warehouse'
       LIMIT 1`,
      [TARGET_USERNAME],
    )

    if (!targetRows.length) {
      const randomPassword = crypto.randomBytes(24).toString('hex')
      const passwordHash = await bcrypt.hash(randomPassword, 10)
      const [created] = await connection.execute(
        `INSERT INTO bp_users (username, password_hash, role, is_active)
         VALUES (?, ?, 'warehouse', 1)`,
        [TARGET_USERNAME, passwordHash],
      )
      targetRows = [{ id: created.insertId }]
    }

    const targetUserId = targetRows[0].id
    await connection.execute(
      `INSERT IGNORE INTO bp_settings (user_id, next_sku, width_in, height_in)
       VALUES (?, 1001, 2.20, 1.00)`,
      [targetUserId],
    )

    const [existingRows] = await connection.execute(
      `SELECT code FROM bp_labels WHERE user_id = ?`,
      [targetUserId],
    )
    const existingCodes = new Set(
      existingRows.map((row) => String(row.code || '').trim()),
    )

    const [orderRows] = await connection.execute(
      `SELECT COALESCE(MAX(sort_order), 0) AS max_order
       FROM bp_labels WHERE user_id = ?`,
      [targetUserId],
    )
    let sortOrder = Number(orderRows[0]?.max_order || 0)
    let copied = 0

    for (const label of uniqueAdminLabels) {
      const code = String(label.code).trim()
      if (existingCodes.has(code)) continue

      sortOrder += 1
      await connection.execute(
        `INSERT INTO bp_labels
          (user_id, product_name, price, code, format, width_in, height_in,
           sort_order, inventory_item_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          targetUserId,
          label.product_name,
          label.price || '',
          code,
          label.format || 'CODE128',
          label.width_in || 2.2,
          label.height_in || 1,
          sortOrder,
          label.inventory_item_id || null,
        ],
      )
      existingCodes.add(code)
      copied += 1
    }

    await connection.commit()

    console.log(`Admin unique barcodes: ${uniqueAdminLabels.length}`)
    console.log(`Hyderabad existing before copy: ${existingRows.length}`)
    console.log(`Copied to Hyderabad Warehouse: ${copied}`)
    console.log(`Hyderabad total after copy: ${existingRows.length + copied}`)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    await connection.end()
  }
})().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
