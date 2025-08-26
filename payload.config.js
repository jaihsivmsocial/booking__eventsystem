const { buildConfig } = require("payload/config")
const { postgresAdapter } = require("@payloadcms/db-postgres")
const { slateEditor } = require("@payloadcms/richtext-slate")

// Import collections
const Tenants = require("./src/collections/Tenants")
const Users = require("./src/collections/Users")
const Events = require("./src/collections/Events")
const Bookings = require("./src/collections/Bookings")
const Notifications = require("./src/collections/Notifications")
const BookingLogs = require("./src/collections/BookingLogs")
// Import endpoints
const bookEventEndpoint = require("./src/endpoints/bookEvent")
const cancelBookingEndpoint = require("./src/endpoints/cancelBooking")
const myBookingsEndpoint = require("./src/endpoints/myBookings")
const myNotificationsEndpoint = require("./src/endpoints/myNotifications")
const markNotificationReadEndpoint = require("./src/endpoints/markNotificationRead")
const dashboardEndpoint = require("./src/endpoints/dashboard")
const registerEndpoint = require("./src/endpoints/register")
const promoteWaitlist = require('./src/endpoints/permoteWaitlist') 
module.exports = buildConfig({
  secret: process.env.PAYLOAD_SECRET,
  admin: {
    disable: true,
  },
  editor: slateEditor({}),
  collections: [Tenants, Users, Events, Bookings, Notifications, BookingLogs],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL,
    },
  }),
  endpoints: [
    bookEventEndpoint,
    cancelBookingEndpoint,
    myBookingsEndpoint,
    myNotificationsEndpoint,
    markNotificationReadEndpoint,
    dashboardEndpoint,
    registerEndpoint,
     promoteWaitlist
  ],
  cors: [process.env.PAYLOAD_PUBLIC_SERVER_URL || "http://localhost:3000", "http://localhost:3001"],
  csrf: [process.env.PAYLOAD_PUBLIC_SERVER_URL || "http://localhost:3000", "http://localhost:3001"],
  onInit: async (payload) => {
    payload.logger.info("Multi-tenant event booking system initialized")
    payload.logger.info("API endpoints available for testing")
    payload.logger.info("Admin interface disabled - using separate frontend")
  },
})
