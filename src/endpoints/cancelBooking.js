const BookingService = require("../utils/bookingService")
const { getNotificationContent } = require("../utils/notifications")

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

const cancelBookingEndpoint = {
  path: "/cancel-booking",
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
      const { bookingId } = req.body

      if (!bookingId) {
        return res.status(400).json({
          success: false,
          error: "Booking ID is required",
        })
      }

      // Validate booking ID format
      if (typeof bookingId !== "string" && typeof bookingId !== "number") {
        return res.status(400).json({
          success: false,
          error: "Invalid booking ID format",
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

      console.log("Cancel booking request:", {
        bookingId,
        userId,
        userTenant: typeof userTenant === "object" ? userTenant.id : userTenant
      })

      // Cancel booking using service
      const result = await BookingService.cancelBooking(bookingId, userId, userTenant)
      const canceledBooking = result.canceledBooking || result // Handle both old and new return formats
      const promotedBookingInfo = result.promotedBookingInfo

      // Get event details for response - use proper ID extraction
      const eventId = extractId(canceledBooking.event)
      const event = await req.payload.findByID({
        collection: "events",
        id: eventId,
      })

      // Get notification content for cancellation
      const notificationContent = getNotificationContent("booking_canceled", event.title)

      // Prepare response data
      const responseData = {
        booking: {
          id: canceledBooking.id,
          status: canceledBooking.status,
          updatedAt: canceledBooking.updatedAt,
        },
        event: {
          id: event.id,
          title: event.title,
          date: event.date,
        },
        notification: {
          type: "booking_canceled",
          title: notificationContent.title,
          message: notificationContent.message,
        },
      }

      // Add promotion information if someone was promoted from waitlist
      if (promotedBookingInfo) {
        const promotionNotificationContent = getNotificationContent("waitlist_promoted", event.title)
        responseData.promotionInfo = {
          message: `Someone from the waitlist has been promoted to confirmed status.`,
          promotedBooking: {
            id: promotedBookingInfo.bookingId,
            notification: {
              type: "waitlist_promoted",
              title: promotionNotificationContent.title,
              message: promotionNotificationContent.message,
            }
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: promotedBookingInfo 
          ? `${notificationContent.message} A waitlisted attendee has been promoted to confirmed.`
          : notificationContent.message,
        data: responseData,
      })
    } catch (error) {
      console.error("Cancel booking error:", error)

      // Handle specific error types
      if (error.message.includes("not found")) {
        return res.status(404).json({
          success: false,
          error: error.message,
        })
      }

      if (error.message.includes("Access denied")) {
        return res.status(403).json({
          success: false,
          error: error.message,
        })
      }

      if (error.message.includes("already been canceled")) {
        return res.status(409).json({ // 409 Conflict for already canceled
          success: false,
          error: error.message,
          code: "ALREADY_CANCELED"
        })
      }

      if (error.message.includes("past events")) {
        return res.status(400).json({
          success: false,
          error: error.message,
        })
      }

      if (error.message.includes("Invalid ID")) {
        return res.status(400).json({
          success: false,
          error: "Invalid booking ID format",
        })
      }

      return res.status(500).json({
        success: false,
        error: "Failed to cancel booking. Please try again.",
      })
    }
  },
}

module.exports = cancelBookingEndpoint