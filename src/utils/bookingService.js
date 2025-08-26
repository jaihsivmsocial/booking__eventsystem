const payload = require("payload")
const { getBookingCounts, getOldestWaitlistedBooking, hasExistingBooking } = require("./database")
const { createNotification, createBookingLog, getNotificationContent } = require("./notifications")

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

// Service to handle complex booking operations
class BookingService {
  // Create a new booking with all business logic
  static async createBooking(userId, eventId, tenant) {
    try {
      // Validate inputs
      if (!userId || !eventId || !tenant) {
        throw new Error("Missing required parameters")
      }

      const eventIdNum = extractId(eventId)
      const userIdNum = extractId(userId)
      const tenantIdNum = extractId(tenant)

      console.log("Creating booking for:", { userIdNum, eventIdNum, tenantIdNum })

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

      const eventTenantId = extractId(event.tenant)

      console.log("Tenant comparison:", { eventTenantId, tenantIdNum })

      if (eventTenantId !== tenantIdNum) {
        throw new Error(
          `Access denied - Event belongs to tenant ${eventTenantId}, user belongs to tenant ${tenantIdNum}`,
        )
      }

      // Validate event date
      if (new Date(event.date) <= new Date()) {
        throw new Error("Cannot book past events")
      }

      // Create the booking (let hooks determine the status)
      const booking = await payload.create({
        collection: "bookings",
        data: {
          event: eventIdNum,
          user: userIdNum,
          tenant: tenantIdNum,
        },
      })

      console.log(`Booking created: ${booking.id} with status: ${booking.status}`)
      return booking
    } catch (error) {
      console.error("Error creating booking:", error)
      throw error
    }
  }

  // Cancel a booking and handle waitlist promotion
  static async cancelBooking(bookingId, userId, tenant) {
    try {
      const bookingIdNum = extractId(bookingId)
      
      // Get the booking with proper ID extraction
      const booking = await payload.findByID({
        collection: "bookings",
        id: bookingIdNum,
      })

      if (!booking) {
        throw new Error("Booking not found")
      }

      // Extract IDs for comparison - handle both object and number cases
      const bookingUserId = extractId(booking.user)
      const bookingTenantId = extractId(booking.tenant)
      const inputTenantId = extractId(tenant)
      const userIdNum = extractId(userId)

      console.log("Access validation:", {
        bookingUserId,
        userIdNum,
        bookingTenantId,
        inputTenantId
      })

      // Validate access
      if (bookingUserId !== userIdNum || bookingTenantId !== inputTenantId) {
        throw new Error("Access denied")
      }

      // Validate booking status
      if (booking.status === "canceled") {
        throw new Error("Booking is already canceled")
      }

      // Get event details for potential promotion notification
      const eventId = extractId(booking.event)
      const event = await payload.findByID({
        collection: "events",
        id: eventId,
      })

      // Check if there's a waitlisted booking that could be promoted (only if this is a confirmed booking)
      let promotedBookingInfo = null
      if (booking.status === "confirmed") {
        const oldestWaitlisted = await getOldestWaitlistedBooking(eventId, inputTenantId)
        if (oldestWaitlisted) {
          // Get user info for the promoted booking
          const promotedUser = await payload.findByID({
            collection: "users",
            id: oldestWaitlisted.user_id,
          })
          
          promotedBookingInfo = {
            bookingId: oldestWaitlisted.id,
            userId: oldestWaitlisted.user_id,
            userEmail: promotedUser?.email || null,
            eventTitle: event?.title || null,
          }
        }
      }

      // Update booking status (hooks will handle waitlist promotion automatically)
      const updatedBooking = await payload.update({
        collection: "bookings",
        id: bookingIdNum,
        data: {
          status: "canceled",
        },
      })

      console.log(`Booking ${bookingIdNum} canceled successfully`)

      // Return both the canceled booking and promotion info
      return {
        canceledBooking: updatedBooking,
        promotedBookingInfo,
      }
    } catch (error) {
      console.error("Error canceling booking:", error)
      throw error
    }
  }

  // Get user's bookings with event details
  static async getUserBookings(userId, tenant, status = null) {
    try {
      const userIdNum = extractId(userId)
      const tenantIdNum = extractId(tenant)
      
      const whereClause = {
        and: [
          {
            user: {
              equals: userIdNum,
            },
          },
          {
            tenant: {
              equals: tenantIdNum,
            },
          },
        ],
      }

      if (status) {
        whereClause.and.push({
          status: {
            equals: status,
          },
        })
      }

      const bookings = await payload.find({
        collection: "bookings",
        where: whereClause,
        populate: {
          event: true,
        },
        sort: "-createdAt",
      })

      return bookings
    } catch (error) {
      console.error("Error getting user bookings:", error)
      throw error
    }
  }

  // Get event bookings with user details (for organizers)
  static async getEventBookings(eventId, organizerId, tenant) {
    try {
      const eventIdNum = extractId(eventId)
      const organizerIdNum = extractId(organizerId)
      const tenantIdNum = extractId(tenant)
      
      // Verify organizer access to event
      const event = await payload.findByID({
        collection: "events",
        id: eventIdNum,
      })

      if (!event) {
        throw new Error("Event not found")
      }

      const eventOrganizerId = extractId(event.organizer)
      const eventTenantId = extractId(event.tenant)

      if (eventOrganizerId !== organizerIdNum || eventTenantId !== tenantIdNum) {
        throw new Error("Access denied")
      }

      const bookings = await payload.find({
        collection: "bookings",
        where: {
          and: [
            {
              event: {
                equals: eventIdNum,
              },
            },
            {
              tenant: {
                equals: tenantIdNum,
              },
            },
          ],
        },
        populate: {
          user: true,
        },
        sort: "createdAt",
      })

      return bookings
    } catch (error) {
      console.error("Error getting event bookings:", error)
      throw error
    }
  }

  // Get booking statistics for an event
  static async getEventBookingStats(eventId, tenant) {
    try {
      const eventIdNum = extractId(eventId)
      const tenantIdNum = extractId(tenant)
      
      const counts = await getBookingCounts(eventIdNum, tenantIdNum)
      const event = await payload.findByID({
        collection: "events",
        id: eventIdNum,
      })

      if (!event) {
        throw new Error("Event not found")
      }

      return {
        capacity: event.capacity,
        confirmed: counts.confirmed,
        waitlisted: counts.waitlisted,
        canceled: counts.canceled,
        available: Math.max(0, event.capacity - counts.confirmed),
        percentageFilled: Math.round((counts.confirmed / event.capacity) * 100),
      }
    } catch (error) {
      console.error("Error getting event booking stats:", error)
      throw error
    }
  }
}

module.exports = BookingService