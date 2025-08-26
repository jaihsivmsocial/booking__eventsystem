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

const markNotificationReadEndpoint = {
  path: "/notifications/:id/read",
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

      // Get notification ID from params
      const { id: notificationId } = req.params

      if (!notificationId) {
        return res.status(400).json({
          success: false,
          error: "Notification ID is required",
        })
      }

      // Validate notification ID format
      if (typeof notificationId !== "string" || notificationId.length < 1) {
        return res.status(400).json({
          success: false,
          error: "Invalid notification ID format",
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

      console.log("Mark notification read request:", {
        notificationId,
        userId,
        userTenant: typeof userTenant === "object" ? userTenant.id : userTenant
      })

      const notificationIdNum = extractId(notificationId)

      // First, verify the notification exists and belongs to the user
      const notification = await req.payload.findByID({
        collection: "notifications",
        id: notificationIdNum,
      })

      if (!notification) {
        return res.status(404).json({
          success: false,
          error: "Notification not found",
        })
      }

      // Verify ownership and tenant access
      const notificationUserId = extractId(notification.user)
      const notificationTenantId = extractId(notification.tenant)
      const inputTenantId = extractId(userTenant)
      const userIdNum = extractId(userId)

      if (notificationUserId !== userIdNum || notificationTenantId !== inputTenantId) {
        return res.status(403).json({
          success: false,
          error: "Access denied - You can only mark your own notifications as read",
        })
      }

      // Check if already read
      if (notification.read) {
        return res.status(200).json({
          success: true,
          message: "Notification already marked as read",
          data: {
            notification: {
              id: notification.id,
              read: true,
              updatedAt: notification.updatedAt,
            },
          },
        })
      }

      // Mark as read
      const updatedNotification = await req.payload.update({
        collection: "notifications",
        id: notificationIdNum,
        data: {
          read: true,
        },
      })

      return res.status(200).json({
        success: true,
        message: "Notification marked as read",
        data: {
          notification: {
            id: updatedNotification.id,
            read: updatedNotification.read,
            updatedAt: updatedNotification.updatedAt,
          },
        },
      })
    } catch (error) {
      console.error("Mark notification read error:", error)

      if (error.message.includes("Invalid ID")) {
        return res.status(400).json({
          success: false,
          error: "Invalid notification ID format",
        })
      }

      return res.status(500).json({
        success: false,
        error: "Failed to mark notification as read. Please try again.",
      })
    }
  },
}

module.exports = markNotificationReadEndpoint