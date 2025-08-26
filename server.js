require("dotenv").config()

require.extensions[".scss"] = () => {}
require.extensions[".css"] = () => {}

const express = require("express")
const payload = require("payload")
const cors = require("cors")

const config = require("./payload.config.js")

const app = express()

app.use(
  cors({
    origin: process.env.PAYLOAD_PUBLIC_SERVER_URL || "http://localhost:3000",
    credentials: true,
  }),
)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

async function start() {
  try {
    console.log("PAYLOAD_SECRET exists:", !!process.env.PAYLOAD_SECRET)
    console.log("DATABASE_URL exists:", !!process.env.DATABASE_URL)

    await payload.init({
      secret: process.env.PAYLOAD_SECRET,
      config: config,
      express: app,
      onInit: () => {
        payload.logger.info(`Payload Admin URL: ${payload.getAdminURL()}`)
        payload.logger.info("Multi-tenant event booking system initialized")
      },
    })

    console.log("✅ Payload initialized successfully")

    // Health check endpoint
    app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        message: "Event Booking System API is running",
        admin: `${req.protocol}://${req.get("host")}/admin`,
      })
    })

    // Basic API routes for testing
    app.get("/api/test", (req, res) => {
      res.json({
        message: "API is working",
        database: "Connected to NeonDB",
        timestamp: new Date().toISOString(),
      })
    })

    const PORT = process.env.PORT || 3000

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`)
      console.log(`📊 Health check: http://localhost:${PORT}/health`)
      console.log(`🔧 API test: http://localhost:${PORT}/api/test`)
      console.log(`👤 Admin panel: http://localhost:${PORT}/admin`)
    })
  } catch (error) {
    console.error("Error starting server:", error)
    console.error("Stack trace:", error.stack)
    process.exit(1)
  }
}

start()
