const { getPool } = require("../database/connection")

// Helper function to extract ID from object or return the value if it's already an ID
const extractId = (value) => {
  if (value === null || value === undefined) {
    throw new Error("ID value cannot be null or undefined")
  }

  if (typeof value === "object" && value !== null && value.id) {
    return Number.parseInt(String(value.id).replace(/[^0-9]/g, ""))
  }

  // Clean any non-numeric characters and convert to integer
  const cleanValue = String(value).replace(/[^0-9]/g, "")
  const intValue = Number.parseInt(cleanValue)

  if (isNaN(intValue)) {
    throw new Error(`Invalid ID value: ${value}`)
  }

  return intValue
}

// Execute query with tenant context and improved error handling
const executeQuery = async (query, params = [], userTenant = null) => {
  const pool = getPool()
  let client = null

  try {
    // Get client from pool with timeout
    client = await pool.connect()

    // Set tenant context if provided
    if (userTenant) {
      await client.query("SET app.current_user_tenant = $1", [userTenant])
    }

    // Execute the main query
    const result = await client.query(query, params)
    return result
  } catch (error) {
    console.error("Database query error:", error)
    
    // Handle specific PostgreSQL error codes
    if (error.code === '25P03') {
      console.log("Idle transaction timeout - this is normal for long-running operations")
    } else if (error.code === '08003') {
      console.log("Connection does not exist - will be recreated")
    } else if (error.code === '08006') {
      console.log("Connection failure - will be recreated")
    }
    
    throw error
  } finally {
    // Always release the client back to pool
    if (client) {
      try {
        client.release()
      } catch (releaseError) {
        console.log("Warning: Error releasing database client:", releaseError.message)
      }
    }
  }
}

// Get booking counts for an event - FIXED to exclude canceled bookings from confirmed count
const getBookingCounts = async (eventId, tenant) => {
  const query = `
    SELECT 
      b.status,
      COUNT(*) as count
    FROM bookings b
    JOIN bookings_rels br_event ON b.id = br_event.parent_id AND br_event.path = 'event'
    JOIN bookings_rels br_tenant ON b.id = br_tenant.parent_id AND br_tenant.path = 'tenant'
    WHERE br_event.events_id = $1 AND br_tenant.tenants_id = $2
    GROUP BY b.status
  `

  try {
    // Extract IDs properly
    const eventIdInt = extractId(eventId)
    const tenantIdInt = extractId(tenant)

    console.log(`Getting booking counts for event ${eventIdInt}, tenant ${tenantIdInt}`)

    const result = await executeQuery(query, [eventIdInt, tenantIdInt])

    const counts = {
      confirmed: 0,
      waitlisted: 0,
      canceled: 0,
    }

    result.rows.forEach((row) => {
      counts[row.status] = Number.parseInt(row.count)
    })

    console.log("Booking counts:", counts)
    return counts
  } catch (error) {
    console.error("Error getting booking counts:", error)
    return { confirmed: 0, waitlisted: 0, canceled: 0 }
  }
}

// Get oldest waitlisted booking for an event
const getOldestWaitlistedBooking = async (eventId, tenant) => {
  const query = `
    SELECT b.id, b.created_at, br_user.users_id as user_id
    FROM bookings b
    JOIN bookings_rels br_event ON b.id = br_event.parent_id AND br_event.path = 'event'
    JOIN bookings_rels br_tenant ON b.id = br_tenant.parent_id AND br_tenant.path = 'tenant'
    JOIN bookings_rels br_user ON b.id = br_user.parent_id AND br_user.path = 'user'
    WHERE br_event.events_id = $1 AND br_tenant.tenants_id = $2 AND b.status = 'waitlisted'
    ORDER BY b.created_at ASC
    LIMIT 1
  `

  try {
    // Extract IDs properly
    const eventIdInt = extractId(eventId)
    const tenantIdInt = extractId(tenant)

    console.log(`Looking for oldest waitlisted booking for event ${eventIdInt}, tenant ${tenantIdInt}`)
    
    const result = await executeQuery(query, [eventIdInt, tenantIdInt])
    
    if (result.rows.length > 0) {
      console.log(`Found waitlisted booking: ${result.rows[0].id}`)
      return result.rows[0]
    } else {
      console.log("No waitlisted bookings found")
      return null
    }
  } catch (error) {
    console.error("Error getting oldest waitlisted booking:", error)
    return null
  }
}

// Check if user already has an ACTIVE booking for an event (excludes canceled)
const hasExistingBooking = async (userId, eventId, tenant) => {
  const query = `
    SELECT b.id, b.status
    FROM bookings b
    JOIN bookings_rels br_user ON b.id = br_user.parent_id AND br_user.path = 'user'
    JOIN bookings_rels br_event ON b.id = br_event.parent_id AND br_event.path = 'event'
    JOIN bookings_rels br_tenant ON b.id = br_tenant.parent_id AND br_tenant.path = 'tenant'
    WHERE br_user.users_id = $1 AND br_event.events_id = $2 AND br_tenant.tenants_id = $3 
    AND b.status IN ('confirmed', 'waitlisted')
    LIMIT 1
  `

  try {
    // Extract IDs properly
    const userIdInt = extractId(userId)
    const eventIdInt = extractId(eventId)
    const tenantIdInt = extractId(tenant)

    console.log(`Checking for existing active booking: user ${userIdInt}, event ${eventIdInt}, tenant ${tenantIdInt}`)

    const result = await executeQuery(query, [userIdInt, eventIdInt, tenantIdInt])
    
    if (result.rows[0]) {
      console.log(`Found existing active booking: ${result.rows[0].id} with status ${result.rows[0].status}`)
      return result.rows[0]
    } else {
      console.log("No existing active booking found")
      return null
    }
  } catch (error) {
    console.error("Error checking existing booking:", error)
    return null
  }
}

// Get dashboard analytics for organizer
const getDashboardAnalytics = async (organizerId, tenant) => {
  const query = `
    SELECT 
      e.id as event_id,
      e.title,
      e.date,
      e.capacity,
      COUNT(CASE WHEN b.status = 'confirmed' THEN 1 END) as confirmed_count,
      COUNT(CASE WHEN b.status = 'waitlisted' THEN 1 END) as waitlisted_count,
      COUNT(CASE WHEN b.status = 'canceled' THEN 1 END) as canceled_count
    FROM events e
    JOIN events_rels er_organizer ON e.id = er_organizer.parent_id AND er_organizer.path = 'organizer'
    JOIN events_rels er_tenant ON e.id = er_tenant.parent_id AND er_tenant.path = 'tenant'
    LEFT JOIN bookings_rels br_event ON e.id = br_event.events_id AND br_event.path = 'event'
    LEFT JOIN bookings b ON br_event.parent_id = b.id
    LEFT JOIN bookings_rels br_tenant ON b.id = br_tenant.parent_id AND br_tenant.path = 'tenant' AND br_tenant.tenants_id = er_tenant.tenants_id
    WHERE er_organizer.users_id = $1 AND er_tenant.tenants_id = $2 AND e.date >= NOW()
    GROUP BY e.id, e.title, e.date, e.capacity
    ORDER BY e.date ASC
  `

  try {
    // Extract IDs properly
    const organizerIdInt = extractId(organizerId)
    const tenantIdInt = extractId(tenant)

    const result = await executeQuery(query, [organizerIdInt, tenantIdInt])
    return result.rows
  } catch (error) {
    console.error("Error getting dashboard analytics:", error)
    return []
  }
}

// Get recent booking activity
const getRecentActivity = async (tenant, limit = 5) => {
  const query = `
    SELECT 
      bl.id,
      bl.action,
      bl.note,
      bl.created_at,
      u.name as user_name,
      e.title as event_title
    FROM booking_logs bl
    JOIN booking_logs_rels blr_user ON bl.id = blr_user.parent_id AND blr_user.path = 'user'
    JOIN users u ON blr_user.users_id = u.id
    JOIN booking_logs_rels blr_event ON bl.id = blr_event.parent_id AND blr_event.path = 'event'
    JOIN events e ON blr_event.events_id = e.id
    JOIN booking_logs_rels blr_tenant ON bl.id = blr_tenant.parent_id AND blr_tenant.path = 'tenant'
    WHERE blr_tenant.tenants_id = $1
    ORDER BY bl.created_at DESC
    LIMIT $2
  `

  try {
    // Extract tenant ID properly
    const tenantIdInt = extractId(tenant)

    const result = await executeQuery(query, [tenantIdInt, limit])
    return result.rows
  } catch (error) {
    console.error("Error getting recent activity:", error)
    return []
  }
}

module.exports = {
  executeQuery,
  getBookingCounts,
  getOldestWaitlistedBooking,
  hasExistingBooking,
  getDashboardAnalytics,
  getRecentActivity,
}