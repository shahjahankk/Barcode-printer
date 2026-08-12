/**
 * Ensure barcode DB exists, then tables can be migrated.
 * Usage: node scripts/ensure-db.js
 */
require('dotenv').config()
const mysql = require('mysql2/promise')

async function main() {
  const host = process.env.DB_HOST
  const port = Number(process.env.DB_PORT || 3306)
  const user = process.env.DB_USER
  const password = process.env.DB_PASSWORD
  const dbName = process.env.DB_NAME || 'petzonep_barcode_printer'

  console.log(`Connecting to ${host} as ${user}...`)
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true,
  })

  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    )
    console.log(`Database ready: ${dbName}`)
  } catch (err) {
    console.error(`CREATE DATABASE failed: ${err.message}`)
    console.log('Checking if database already exists...')
    try {
      await conn.query(`USE \`${dbName}\``)
      console.log(`Database accessible: ${dbName}`)
    } catch (err2) {
      console.error(`Database not accessible: ${err2.message}`)
      console.error(
        'Create DB in cPanel → MySQL Databases → add database petzonep_barcode_printer and assign user petzonep_zubairahmed, then re-run.',
      )
      process.exit(1)
    }
  }

  await conn.end()
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
