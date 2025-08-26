const { getBookingCounts, getOldestWaitlistedBooking } = require("../utils/database")
const { getNotificationContent } = require("../utils/notifications")

// Helper function to extract ID from object or return the value if it's already an ID
const extractId = (value) => {
  if (value === null || value === undefined) {
    throw new Error("ID value cannot be null or undefined")
  }

  if (typeof value === "object" && value !== null && value.id) {
    return Number.parseInt(String(value.id).replace(/[^0-9]/g, ""))
  }

  const cleanValue = String(value).replace(/[^0-9]/g, "")
  const intValue = Number.parseInt(cleanValue)

  if (isNaN(intValue)) {
    throw new Error(`Invalid ID value: ${value}`)
  }

  return intValue
}

const promoteWaitlistEndpoint = {
  path: "/promote-waitlist",
  method: "post",
  handler: async (req, res) => {
    try {
      // Check authentication and admin/organizer privileges
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        })
      }

      if (!["admin", "organizer"].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: "Only admins and organizers can promote waitlisted users",
        })
      }

      const { eventId } = req.body

      if (!eventId) {
        return res.status(400).json({
          success: false,
          error: "Event ID is required",
        })
      }

      const userTenant = req.user.tenant
      const eventIdNum = extractId(eventId)
      const tenantIdNum = extractId(userTenant)

      // Get event details and verify access
      const event = await req.payload.findByID({
        collection: "events",
        id: eventIdNum,
      })

      if (!event) {
        return res.status(404).json({
          success: false,
          error: "Event not found",
        })
      }

      // Verify organizer has access to this event
      const eventTenantId = extractId(event.tenant)
      const eventOrganizerId = extractId(event.organizer)

      if (eventTenantId !== tenantIdNum) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        })
      }

      if (req.user.role === "organizer" && eventOrganizerId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: "You can only promote waitlisted users for your own events",
        })
      }

      // Get current booking counts
      const counts = await getBookingCounts(eventIdNum, tenantIdNum)

      // Check if there's space available
      if (counts.confirmed >= event.capacity) {
        return res.status(400).json({
          success: false,
          error: "Event is at full capacity. Cannot promote waitlisted bookings.",
        })
      }

      // Find oldest waitlisted booking
      const oldestWaitlisted = await getOldestWaitlistedBooking(eventIdNum, tenantIdNum)

      if (!oldestWaitlisted) {
        return res.status(200).json({
          success: true,
          message: "No waitlisted bookings to promote",
          data: {
            promoted: false,
            availableSpots: event.capacity - counts.confirmed,
          },
        })
      }

      // Promote the booking
      const promotedBooking = await req.payload.update({
        collection: "bookings",
        id: oldestWaitlisted.id,
        data: {
          status: "confirmed",
        },
      })

      // Get promoted user details
      const promotedUser = await req.payload.findByID({
        collection: "users",
        id: oldestWaitlisted.user_id,
      })

      // Get notification content
      const notificationContent = getNotificationContent("waitlist_promoted", event.title)

      return res.status(200).json({
        success: true,
        message: notificationContent.message,
        data: {
          booking: {
            id: promotedBooking.id,
            status: promotedBooking.status,
            updatedAt: promotedBooking.updatedAt,
          },
          user: {
            id: promotedUser.id,
            name: promotedUser.name,
            email: promotedUser.email,
          },
          event: {
            id: event.id,
            title: event.title,
            date: event.date,
          },
          notification: {
            type: "waitlist_promoted",
            title: notificationContent.title,
            message: notificationContent.message,
          },
        },
      })
    } catch (error) {
      console.error("Promotion error:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to promote waitlisted booking",
      })
    }
  },
}

module.exports = promoteWaitlistEndpoint