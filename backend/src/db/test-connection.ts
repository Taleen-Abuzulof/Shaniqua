import { pool } from './index.js'

async function main() {
  try {
    const result = await pool.query('select now() as now, current_database() as db')
    console.log('✅ Database connection succeeded')
    console.log(`   database: ${result.rows[0].db}`)
    console.log(`   server time: ${result.rows[0].now}`)
  } catch (err) {
    console.error('❌ Database connection failed')
    console.error(err)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

main()
