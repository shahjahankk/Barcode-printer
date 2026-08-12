/**
 * Create LabelPress tables on the configured DB (petzonep_barcode_printer).
 * Usage: node scripts/migrate.js
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')

async function migrate() {
  const config = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'petzonep_barcode_printer',
    multipleStatements: true,
  }

  console.log(`Connecting to ${config.host} / ${config.database} as ${config.user}...`)
  const conn = await mysql.createConnection(config)

  const sqlPath = path.join(__dirname, '..', 'sql', 'schema.sql')
  let sql = fs.readFileSync(sqlPath, 'utf8')
  // Connection already selects DB — drop USE if present
  sql = sql.replace(/^\s*USE\s+\w+\s*;/im, '')

  await conn.query(sql)
  const [tables] = await conn.query('SHOW TABLES')
  console.log('Tables:', tables.map((r) => Object.values(r)[0]).join(', '))
  await conn.end()
  console.log('Migration complete.')
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
