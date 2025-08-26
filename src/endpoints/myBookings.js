const BookingService = require("../utils/bookingService")
const { getNotificationContent } = require("../utils/notifications")

const myBookingsEndpoint = {
  path: "/my-bookings",
  method: "get",
  handler: async (req, res) => {
    try {
      // Check authentication
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        })
      }

      // Get query parameters
      const { status, page = 1, limit = 10 } = req.query

      // Validate pagination parameters
      const pageNum = Number.parseInt(page, 10)
      const limitNum = Number.parseInt(limit, 10)

      if (Number.isNaN(pageNum) || pageNum < 1) {
        return res.status(400).json({
          success: false,
          error: "Invalid page number",
        })
      }

      if (Number.isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({
          success: false,
          error: "Invalid limit (must be between 1 and 100)",
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

      // Build where clause
      const whereClause = {
        and: [
          {
            user: {
              equals: userId,
            },
          },
          {
            tenant: {
              equals: userTenant,
            },
          },
        ],
      }

      // Add status filter if provided
      if (status && ["confirmed", "waitlisted", "canceled"].includes(status)) {
        whereClause.and.push({
          status: {
            equals: status,
          },
        })
      }

      // Get bookings with pagination
      const bookings = await req.payload.find({
        collection: "bookings",
        where: whereClause,
        populate: {
          event: true,
        },
        sort: "-createdAt",
        page: pageNum,
        limit: limitNum,
      })

      // Format response data with notification messages
      const formattedBookings = bookings.docs.map((booking) => {
        // Get notification content for current booking status
        let notificationType = "booking_confirmed"
        if (booking.status === "waitlisted") {
          notificationType = "waitlisted"
        } else if (booking.status === "canceled") {
          notificationType = "booking_canceled"
        }

        const notificationContent = getNotificationContent(notificationType, booking.event.title)

        return {
          id: booking.id,
          status: booking.status,
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt,
          event: {
            id: booking.event.id,
            title: booking.event.title,
            description: booking.event.description,
            date: booking.event.date,
            capacity: booking.event.capacity,
          },
          notification: {
            type: notificationType,
            title: notificationContent.title,
            message: notificationContent.message,
          },
        }
      })

      return res.status(200).json({
        success: true,
        data: {
          bookings: formattedBookings,
          pagination: {
            page: bookings.page,
            limit: bookings.limit,
            totalPages: bookings.totalPages,
            totalDocs: bookings.totalDocs,
            hasNextPage: bookings.hasNextPage,
            hasPrevPage: bookings.hasPrevPage,
          },
        },
      })
    } catch (error) {
      console.error("Get my bookings error:", error)

      return res.status(500).json({
        success: false,
        error: "Failed to retrieve bookings. Please try again.",
      })
    }
  },
}

module.exports = myBookingsEndpoint