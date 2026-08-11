const express = require('express')
const { query } = require('../db')
const { authRequired } = require('../middleware/auth')

const router = express.Router()

router.use(authRequired)

router.get('/', async (req, res) => {
  try {
    const rows = await query(
      `SELECT next_sku, width_in, height_in FROM bp_settings WHERE user_id = :userId LIMIT 1`,
      { userId: req.user.id }
    )
    if (!rows.length) {
      await query(
        `INSERT INTO bp_settings (user_id, next_sku, width_in, height_in)
         VALUES (:userId, 1001, 2.20, 1.00)`,
        { userId: req.user.id }
      )
      return res.json({
        success: true,
        settings: { nextSku: 1001, widthIn: 2.2, heightIn: 1 },
      })
    }
    const s = rows[0]
    return res.json({
      success: true,
      settings: {
        nextSku: Number(s.next_sku),
        widthIn: Number(s.width_in),
        heightIn: Number(s.height_in),
      },
    })
  } catch (err) {
    console.error('settings get', err)
    return res.status(500).json({ success: false, message: 'Failed to load settings' })
  }
})

router.put('/', async (req, res) => {
  try {
    const nextSku = Math.max(1, Number(req.body?.nextSku) || 1001)
    let widthIn = Number(req.body?.widthIn)
    let heightIn = Number(req.body?.heightIn)
    if (!Number.isFinite(widthIn)) widthIn = 2.2
    if (!Number.isFinite(heightIn)) heightIn = 1
    widthIn = Math.min(2.2, Math.max(0.5, widthIn))
    heightIn = Math.min(6, Math.max(0.38, heightIn))

    await query(
      `INSERT INTO bp_settings (user_id, next_sku, width_in, height_in)
       VALUES (:userId, :nextSku, :widthIn, :heightIn)
       ON DUPLICATE KEY UPDATE
         next_sku = VALUES(next_sku),
         width_in = VALUES(width_in),
         height_in = VALUES(height_in)`,
      { userId: req.user.id, nextSku, widthIn, heightIn }
    )

    return res.json({
      success: true,
      settings: { nextSku, widthIn, heightIn },
    })
  } catch (err) {
    console.error('settings put', err)
    return res.status(500).json({ success: false, message: 'Failed to save settings' })
  }
})

module.exports = router
