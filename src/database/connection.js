const { Pool } = require("pg")

// Database connection pool
let pool = null

const createPool = () => {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 20000, // 20 seconds for NeonDB
      query_timeout: 15000, // 15 seconds for queries
      statement_timeout: 15000,
    })

    // Handle pool errors
    pool.on("error", (err) => {
      console.error("Unexpected error on idle client", err)
      process.exit(-1)
    })

    // Handle pool connection
    pool.on("connect", () => {
      console.log("Connected to NeonDB")
    })
  }

  return pool
}

const getPool = () => {
  if (!pool) {
    return createPool()
  }
  return pool
}

const closePool = async () => {
  if (pool) {
    await pool.end()
    pool = null
  }
}

const testConnection = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Testing database connection (attempt ${i + 1}/${retries})...`)
      const client = await getPool().connect()
      const result = await client.query("SELECT NOW()")
      client.release()
      console.log("Database connection successful:", result.rows[0])
      return true
    } catch (error) {
      console.error(`Database connection attempt ${i + 1} failed:`, error.message)
      if (i === retries - 1) {
        console.error("All connection attempts failed")
        return false
      }
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }
  return false
}

module.exports = {
  createPool,
  getPool,
  closePool,
  testConnection,
}
