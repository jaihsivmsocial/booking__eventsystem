const payload = require("payload")
const { getBookingCounts, getOldestWaitlistedBooking, hasExistingBooking } = require("../utils/database")
const { createNotification, createBookingLog, getNotificationContent } = require("../utils/notifications")

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

// Hook to handle booking creation logic
const handleBookingCreation = async ({ req, data }) => {
  try {
    // Validate required fields
    if (!data.event || !data.user || !data.tenant) {
      throw new Error("Missing required fields: event, user, or tenant")
    }

    const eventIdNum = extractId(data.event)
    const userIdNum = extractId(data.user)
    const tenantIdNum = extractId(data.tenant)

    console.log("Processing booking creation:", { eventIdNum, userIdNum, tenantIdNum })

    // Check for existing ACTIVE booking (excludes canceled bookings)
    const existingBooking = await hasExistingBooking(userIdNum, eventIdNum, tenantIdNum)
    if (existingBooking) {
      throw new Error(`You already have an active booking for this event (Status: ${existingBooking.status})`)
    }

    // Get event details
    const event = await payload.findByID({
      collection: "events",
      id: eventIdNum,
    })

    if (!event) {
      throw new Error("Event not found")
    }

    // Validate event date
    if (new Date(event.date) <= new Date()) {
      throw new Error("Cannot book past events")
    }

    // Validate tenant access
    const eventTenantId = extractId(event.tenant)

    if (eventTenantId !== tenantIdNum) {
      throw new Error("Access denied: Event not in your organization")
    }

    // Get current booking counts using SQL queries
    const counts = await getBookingCounts(eventIdNum, tenantIdNum)
    console.log("Current booking counts:", counts, "Event capacity:", event.capacity)

    // Determine booking status based on capacity
    // Check if there's space available (only count confirmed bookings against capacity)
    if (counts.confirmed < event.capacity) {
      data.status = "confirmed"
      console.log("Space available - setting status to confirmed")
    } else {
      data.status = "waitlisted"
      console.log("Event at capacity - setting status to waitlisted")
    }

    // Ensure we're passing integers
    data.event = eventIdNum
    data.user = userIdNum
    data.tenant = tenantIdNum

    console.log("Booking will be created with status:", data.status)
    return data
  } catch (error) {
    console.error("Error in booking creation hook:", error)
    throw error
  }
}

// Async function to handle notifications and logs after booking is fully created
const processBookingNotifications = async (docId, userId, eventId, tenantId, status, operation, previousStatus = null) => {
  try {
    // Wait a bit to ensure the booking is fully committed
    await new Promise(resolve => setTimeout(resolve, 500))

    // Verify the booking exists before creating notifications
    const booking = await payload.findByID({
      collection: "bookings",
      id: docId,
    })

    if (!booking) {
      console.error(`Booking ${docId} not found when creating notifications`)
      return
    }

    // Get event details for notifications
    const event = await payload.findByID({
      collection: "events",
      id: extractId(eventId),
    })

    if (!event) {
      console.error("Event not found for booking:", docId)
      return
    }

    const userIdInt = extractId(userId)
    const eventIdInt = extractId(eventId)
    const tenantIdInt = extractId(tenantId)

    // Handle new booking creation
    if (operation === "create") {
      const notificationType = status === "confirmed" ? "booking_confirmed" : "waitlisted"
      const logAction = status === "confirmed" ? "auto_confirm" : "auto_waitlist"

      const { title, message } = getNotificationContent(notificationType, event.title)

      try {
        // Create notification
        await createNotification(userIdInt, docId, notificationType, title, message, tenantIdInt)
        console.log(`Notification created for booking ${docId}`)
      } catch (notificationError) {
        console.error("Failed to create notification:", notificationError)
      }

      try {
        // Create booking log
        await createBookingLog(
          docId,
          eventIdInt,
          userIdInt,
          logAction,
          `Booking ${status === "confirmed" ? "confirmed" : "added to waitlist"} for event: ${event.title}`,
          tenantIdInt,
        )
        console.log(`Booking log created for booking ${docId}`)
      } catch (logError) {
        console.error("Failed to create booking log:", logError)
      }

      console.log(`Booking ${docId} created with status: ${status}`)
      return
    }

    // Handle status changes for existing bookings
    if (operation === "update" && previousStatus && previousStatus !== status) {
      let notificationType = "booking_confirmed"
      let logAction = "auto_confirm"

      if (status === "confirmed" && previousStatus === "waitlisted") {
        notificationType = "waitlist_promoted"
        logAction = "promote_from_waitlist"
      } else if (status === "canceled") {
        notificationType = "booking_canceled"
        logAction = "cancel_confirmed"
      }

      const { title, message } = getNotificationContent(notificationType, event.title)

      try {
        // Create notification
        await createNotification(userIdInt, docId, notificationType, title, message, tenantIdInt)
        console.log(`Status change notification created for booking ${docId}`)
      } catch (notificationError) {
        console.error("Failed to create notification:", notificationError)
      }

      try {
        // Create booking log
        await createBookingLog(
          docId,
          eventIdInt,
          userIdInt,
          logAction,
          `Booking status changed from ${previousStatus} to ${status} for event: ${event.title}`,
          tenantIdInt,
        )
        console.log(`Status change log created for booking ${docId}`)
      } catch (logError) {
        console.error("Failed to create booking log:", logError)
      }

      console.log(`Booking ${docId} status changed from ${previousStatus} to ${status}`)
    }
  } catch (error) {
    console.error("Error in processBookingNotifications:", error)
  }
}

// Hook to handle booking status changes and notifications
const handleBookingStatusChange = async ({ req, doc, previousDoc, operation }) => {
  try {
    const eventId = extractId(doc.event)
    const userId = extractId(doc.user)
    const tenantId = extractId(doc.tenant)

    // Process notifications asynchronously to avoid blocking the main operation
    setImmediate(() => {
      processBookingNotifications(
        doc.id,
        userId,
        eventId,
        tenantId,
        doc.status,
        operation,
        previousDoc?.status
      )
    })

  } catch (error) {
    console.error("Error in booking status change hook:", error)
    // Don't throw the error to prevent breaking the booking creation
  }
}

// Hook to handle waitlist promotion when a booking is canceled - FIXED VERSION
const handleWaitlistPromotion = async ({ req, doc, previousDoc }) => {
  try {
    // Only process if a confirmed booking was canceled
    if (!previousDoc || previousDoc.status !== "confirmed" || doc.status !== "canceled") {
      console.log("Skipping waitlist promotion - not a confirmed->canceled transition")
      return
    }

    console.log(`Processing waitlist promotion for canceled booking: ${doc.id}`)

    const eventId = extractId(doc.event)
    const tenantId = extractId(doc.tenant)

    // Use a small delay to ensure the cancellation is fully committed
    setTimeout(async () => {
      try {
        // Find the oldest waitlisted booking for this event using SQL
        const oldestWaitlisted = await getOldestWaitlistedBooking(eventId, tenantId)

        if (!oldestWaitlisted) {
          console.log("No waitlisted bookings found to promote")
          return
        }

        console.log(`Found oldest waitlisted booking: ${oldestWaitlisted.id} for user ${oldestWaitlisted.user_id}`)

        // Get current booking counts to verify there's space
        const counts = await getBookingCounts(eventId, tenantId)
        const event = await payload.findByID({
          collection: "events",
          id: eventId,
        })

        if (!event) {
          console.error("Event not found during waitlist promotion")
          return
        }

        console.log(`Current counts: confirmed=${counts.confirmed}, capacity=${event.capacity}`)

        // Verify there's space available
        if (counts.confirmed >= event.capacity) {
          console.warn(`Cannot promote - event still at capacity (${counts.confirmed}/${event.capacity})`)
          return
        }

        // Promote the waitlisted booking to confirmed
        const promotedBooking = await payload.update({
          collection: "bookings",
          id: oldestWaitlisted.id,
          data: {
            status: "confirmed",
          },
        })

        console.log(`Successfully promoted booking ${oldestWaitlisted.id} from waitlist to confirmed`)

      } catch (promotionError) {
        console.error("Error in delayed waitlist promotion:", promotionError)
      }
    }, 1000) // 1 second delay to ensure cancellation is committed

  } catch (error) {
    console.error("Error in waitlist promotion hook:", error)
  }
}

// Hook to validate booking updates
const validateBookingUpdate = async ({ req, data, originalDoc }) => {
  try {
    // Prevent changing event or user after creation
    if (originalDoc) {
      const dataEventId = data.event ? extractId(data.event) : null
      const originalEventId = extractId(originalDoc.event)
      const dataUserId = data.user ? extractId(data.user) : null
      const originalUserId = extractId(originalDoc.user)
      const dataTenantId = data.tenant ? extractId(data.tenant) : null
      const originalTenantId = extractId(originalDoc.tenant)

      if (dataEventId && dataEventId !== originalEventId) {
        throw new Error("Cannot change event for existing booking")
      }
      if (dataUserId && dataUserId !== originalUserId) {
        throw new Error("Cannot change user for existing booking")
      }
      if (dataTenantId && dataTenantId !== originalTenantId) {
        throw new Error("Cannot change tenant for existing booking")
      }
    }

    // Validate status transitions
    if (originalDoc && data.status && data.status !== originalDoc.status) {
      const validTransitions = {
        confirmed: ["canceled"],
        waitlisted: ["confirmed", "canceled"],
        canceled: [], // Cannot change from canceled
      }

      const allowedStatuses = validTransitions[originalDoc.status] || []
      if (!allowedStatuses.includes(data.status)) {
        throw new Error(`Invalid status transition from ${originalDoc.status} to ${data.status}`)
      }
    }

    return data
  } catch (error) {
    console.error("Error in booking validation hook:", error)
    throw error
  }
}

// Hook to handle capacity validation - but allow waitlist promotions
const validateEventCapacity = async ({ req, data, originalDoc, operation }) => {
  try {
    // Only validate for status changes to confirmed
    if (operation === "update" && data.status === "confirmed" && originalDoc?.status !== "confirmed") {
      const eventId = extractId(originalDoc.event)

      const event = await payload.findByID({
        collection: "events",
        id: eventId,
      })

      if (!event) {
        throw new Error("Event not found")
      }

      const tenantId = extractId(originalDoc.tenant)
      const counts = await getBookingCounts(eventId, tenantId)

      // IMPORTANT: Allow waitlist promotion even if at capacity
      // This happens when someone cancels and we're promoting the next person
      if (originalDoc.status === "waitlisted") {
        console.log(`Allowing waitlist promotion for booking ${originalDoc.id} - bypassing capacity check`)
        return data
      }

      // For other status changes (like manual admin changes), enforce capacity
      if (counts.confirmed >= event.capacity) {
        throw new Error("Event is at full capacity")
      }
    }

    return data
  } catch (error) {
    console.error("Error in capacity validation hook:", error)
    throw error
  }
}

module.exports = {
  handleBookingCreation,
  handleBookingStatusChange,
  handleWaitlistPromotion,
  validateBookingUpdate,
  validateEventCapacity,
}