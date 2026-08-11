const express = require('express')
const { query } = require('../db')
const { authRequired } = require('../middleware/auth')

const router = express.Router()
const FORMATS = new Set(['CODE128', 'EAN13', 'UPC'])

router.use(authRequired)

function mapLabel(row) {
  return {
    id: String(row.id),
    clientId: row.client_id || null,
    productName: row.product_name,
    price: row.price || '',
    code: row.code,
    format: row.format,
    widthIn: Number(row.width_in),
    heightIn: Number(row.height_in),
    sortOrder: Number(row.sort_order || 0),
    inventoryItemId: row.inventory_item_id || null,
    createdAt: row.created_at,
  }
}

router.get('/', async (req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM bp_labels
       WHERE user_id = :userId
       ORDER BY sort_order ASC, id ASC`,
      { userId: req.user.id }
    )
    return res.json({ success: true, items: rows.map(mapLabel) })
  } catch (err) {
    console.error('labels list', err)
    return res.status(500).json({ success: false, message: 'Failed to load labels' })
  }
})

router.post('/', async (req, res) => {
  try {
    const productName = String(req.body?.productName || '').trim()
    const code = String(req.body?.code || '').trim()
    const format = String(req.body?.format || 'CODE128').toUpperCase()
    const price = String(req.body?.price || '').trim()
    const clientId = req.body?.clientId ? String(req.body.clientId).slice(0, 64) : null
    let widthIn = Number(req.body?.widthIn)
    let heightIn = Number(req.body?.heightIn)
    if (!productName || !code) {
      return res.status(400).json({ success: false, message: 'productName and code required' })
    }
    if (!FORMATS.has(format)) {
      return res.status(400).json({ success: false, message: 'Invalid format' })
    }
    if (!Number.isFinite(widthIn)) widthIn = 2.2
    if (!Number.isFinite(heightIn)) heightIn = 1

    const maxRows = await query(
      `SELECT COALESCE(MAX(sort_order), 0) AS m FROM bp_labels WHERE user_id = :userId`,
      { userId: req.user.id }
    )
    const sortOrder = Number(maxRows[0]?.m || 0) + 1

    const result = await query(
      `INSERT INTO bp_labels
        (user_id, client_id, product_name, price, code, format, width_in, height_in, sort_order, inventory_item_id)
       VALUES
        (:userId, :clientId, :productName, :price, :code, :format, :widthIn, :heightIn, :sortOrder, :inventoryItemId)`,
      {
        userId: req.user.id,
        clientId,
        productName,
        price,
        code,
        format,
        widthIn,
        heightIn,
        sortOrder,
        inventoryItemId: req.body?.inventoryItemId
          ? String(req.body.inventoryItemId).slice(0, 64)
          : null,
      }
    )

    const rows = await query(`SELECT * FROM bp_labels WHERE id = :id LIMIT 1`, {
      id: result.insertId,
    })
    return res.status(201).json({ success: true, item: mapLabel(rows[0]) })
  } catch (err) {
    console.error('labels create', err)
    return res.status(500).json({ success: false, message: 'Failed to create label' })
  }
})

/** Replace entire batch (used by Save / auto-sync from LabelPress) */
router.put('/batch', async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : null
    if (!items) {
      return res.status(400).json({ success: false, message: 'items array required' })
    }

    const conn = await require('../db').getPool().getConnection()
    try {
      await conn.beginTransaction()
      await conn.execute(`DELETE FROM bp_labels WHERE user_id = ?`, [req.user.id])

      let order = 1
      for (const raw of items) {
        const productName = String(raw.productName || '').trim()
        const code = String(raw.code || '').trim()
        const format = String(raw.format || 'CODE128').toUpperCase()
        if (!productName || !code || !FORMATS.has(format)) continue
        const widthIn = Number.isFinite(Number(raw.widthIn)) ? Number(raw.widthIn) : 2.2
        const heightIn = Number.isFinite(Number(raw.heightIn)) ? Number(raw.heightIn) : 1
        await conn.execute(
          `INSERT INTO bp_labels
            (user_id, client_id, product_name, price, code, format, width_in, height_in, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user.id,
            raw.clientId || raw.id
              ? String(raw.clientId || raw.id).slice(0, 64)
              : null,
            productName,
            String(raw.price || '').trim(),
            code,
            format,
            widthIn,
            heightIn,
            order++,
          ]
        )
      }

      if (req.body?.nextSku != null || req.body?.widthIn != null) {
        const nextSku = Math.max(1, Number(req.body.nextSku) || 1001)
        let widthIn = Number(req.body.widthIn)
        let heightIn = Number(req.body.heightIn)
        if (!Number.isFinite(widthIn)) widthIn = 2.2
        if (!Number.isFinite(heightIn)) heightIn = 1
        await conn.execute(
          `INSERT INTO bp_settings (user_id, next_sku, width_in, height_in)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             next_sku = VALUES(next_sku),
             width_in = VALUES(width_in),
             height_in = VALUES(height_in)`,
          [req.user.id, nextSku, widthIn, heightIn]
        )
      }

      await conn.commit()
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }

    const rows = await query(
      `SELECT * FROM bp_labels WHERE user_id = :userId ORDER BY sort_order ASC, id ASC`,
      { userId: req.user.id }
    )
    return res.json({ success: true, items: rows.map(mapLabel) })
  } catch (err) {
    console.error('labels batch', err)
    return res.status(500).json({ success: false, message: 'Failed to save batch' })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: 'Invalid id' })
    }
    const existing = await query(
      `SELECT * FROM bp_labels WHERE id = :id AND user_id = :userId LIMIT 1`,
      { id, userId: req.user.id }
    )
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Label not found' })
    }

    const cur = existing[0]
    const productName =
      req.body?.productName != null ? String(req.body.productName).trim() : cur.product_name
    const price = req.body?.price != null ? String(req.body.price).trim() : cur.price
    const code = req.body?.code != null ? String(req.body.code).trim() : cur.code
    const format =
      req.body?.format != null ? String(req.body.format).toUpperCase() : cur.format
    if (!FORMATS.has(format)) {
      return res.status(400).json({ success: false, message: 'Invalid format' })
    }

    await query(
      `UPDATE bp_labels SET
         product_name = :productName,
         price = :price,
         code = :code,
         format = :format,
         width_in = :widthIn,
         height_in = :heightIn
       WHERE id = :id AND user_id = :userId`,
      {
        productName,
        price,
        code,
        format,
        widthIn: Number.isFinite(Number(req.body?.widthIn))
          ? Number(req.body.widthIn)
          : Number(cur.width_in),
        heightIn: Number.isFinite(Number(req.body?.heightIn))
          ? Number(req.body.heightIn)
          : Number(cur.height_in),
        id,
        userId: req.user.id,
      }
    )

    const rows = await query(`SELECT * FROM bp_labels WHERE id = :id LIMIT 1`, { id })
    return res.json({ success: true, item: mapLabel(rows[0]) })
  } catch (err) {
    console.error('labels patch', err)
    return res.status(500).json({ success: false, message: 'Failed to update label' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const result = await query(
      `DELETE FROM bp_labels WHERE id = :id AND user_id = :userId`,
      { id, userId: req.user.id }
    )
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Label not found' })
    }
    return res.json({ success: true })
  } catch (err) {
    console.error('labels delete', err)
    return res.status(500).json({ success: false, message: 'Failed to delete label' })
  }
})

module.exports = router
