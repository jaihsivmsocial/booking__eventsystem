const BookingService = require("../utils/bookingService")
const { getNotificationContent } = require("../utils/notifications")
const bookEventEndpoint = {
  path: "/book-event",
  method: "post",
  handler: async (req, res) => {
    try {
      // Check authentication
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        })
      }

      // Validate request body
      const { eventId } = req.body

      if (!eventId) {
        return res.status(400).json({
          success: false,
          error: "Event ID is required",
        })
      }

      // Validate event ID format
      if (typeof eventId !== "string" || eventId.length < 1) {
        return res.status(400).json({
          success: false,
          error: "Invalid event ID format",
        })
      }

      // Get user details
      const userId = req.user.id
      const userTenant = req.user.tenant

      if (!userTenant) {
        return res.status(400).json({
          success: false,
          error: "User tenant not found",
        })
      }

      // Create booking using service
      const booking = await BookingService.createBooking(userId, eventId, userTenant)

      // Get event details for response
      const event = await req.payload.findByID({
        collection: "events",
        id: eventId,
      })

      // Get notification content based on booking status
      const notificationType = booking.status === "confirmed" ? "booking_confirmed" : "waitlisted"
      const notificationContent = getNotificationContent(notificationType, event.title)

      return res.status(201).json({
        success: true,
        message: notificationContent.message,
        data: {
          booking: {
            id: booking.id,
            status: booking.status,
            createdAt: booking.createdAt,
          },
          event: {
            id: event.id,
            title: event.title,
            date: event.date,
          },
          notification: {
            type: notificationType,
            title: notificationContent.title,
            message: notificationContent.message,
          },
        },
      })
    } catch (error) {
      console.error("Book event error:", error)

      // Handle specific error types
      if (error.message.includes("already have")) {
        return res.status(409).json({
          success: false,
          error: error.message,
        })
      }

      if (error.message.includes("not found")) {
        return res.status(404).json({
          success: false,
          error: error.message,
        })
      }

      if (error.message.includes("past events") || error.message.includes("Access denied")) {
        return res.status(400).json({
          success: false,
          error: error.message,
        })
      }

      return res.status(500).json({
        success: false,
        error: "Failed to create booking. Please try again.",
      })
    }
  },
}



module.exports = bookEventEndpoint