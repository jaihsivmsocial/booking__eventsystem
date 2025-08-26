const { getUnreadNotificationCount } = require("../utils/notifications")

const myNotificationsEndpoint = {
  path: "/my-notifications",
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
      const { unreadOnly = "false", page = 1, limit = 20 } = req.query

      // Validate pagination parameters
      const pageNum = Number.parseInt(page, 10)
      const limitNum = Number.parseInt(limit, 10)

      if (Number.isNaN(pageNum) || pageNum < 1) {
        return res.status(400).json({
          success: false,
          error: "Invalid page number",
        })
      }

      if (Number.isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
        return res.status(400).json({
          success: false,
          error: "Invalid limit (must be between 1 and 50)",
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

      // Add unread filter if requested
      if (unreadOnly === "true") {
        whereClause.and.push({
          read: {
            equals: false,
          },
        })
      }

      // Get notifications with pagination
      const notifications = await req.payload.find({
        collection: "notifications",
        where: whereClause,
        populate: {
          booking: {
            populate: {
              event: true,
            },
          },
        },
        sort: "-createdAt",
        page: pageNum,
        limit: limitNum,
      })

      // Get unread count
      const unreadCount = await getUnreadNotificationCount(userId, userTenant)

      // Format response data
      const formattedNotifications = notifications.docs.map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        read: notification.read,
        createdAt: notification.createdAt,
        booking: {
          id: notification.booking.id,
          status: notification.booking.status,
        },
        event: {
          id: notification.booking.event.id,
          title: notification.booking.event.title,
          date: notification.booking.event.date,
        },
      }))

      return res.status(200).json({
        success: true,
        data: {
          notifications: formattedNotifications,
          unreadCount,
          pagination: {
            page: notifications.page,
            limit: notifications.limit,
            totalPages: notifications.totalPages,
            totalDocs: notifications.totalDocs,
            hasNextPage: notifications.hasNextPage,
            hasPrevPage: notifications.hasPrevPage,
          },
        },
      })
    } catch (error) {
      console.error("Get my notifications error:", error)

      return res.status(500).json({
        success: false,
        error: "Failed to retrieve notifications. Please try again.",
      })
    }
  },
}

module.exports = myNotificationsEndpoint
