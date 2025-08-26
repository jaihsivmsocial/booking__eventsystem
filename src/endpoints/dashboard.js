const { getDashboardAnalytics, getRecentActivity } = require("../utils/database")

const dashboardEndpoint = {
  path: "/dashboard",
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

      // Check if user is organizer or admin
      if (!["organizer", "admin"].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: "Access denied. Organizer or admin role required.",
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

      // Get dashboard analytics
      const eventsData = await getDashboardAnalytics(userId, userTenant)

      // Get recent activity
      const recentActivity = await getRecentActivity(userTenant, 5)

      // Calculate summary statistics
      let totalEvents = 0
      let totalConfirmedBookings = 0
      let totalWaitlistedBookings = 0
      let totalCanceledBookings = 0

      const upcomingEvents = eventsData.map((event) => {
        const confirmedCount = Number.parseInt(event.confirmed_count) || 0
        const waitlistedCount = Number.parseInt(event.waitlisted_count) || 0
        const canceledCount = Number.parseInt(event.canceled_count) || 0
        const capacity = Number.parseInt(event.capacity) || 1

        // Add to totals
        totalEvents++
        totalConfirmedBookings += confirmedCount
        totalWaitlistedBookings += waitlistedCount
        totalCanceledBookings += canceledCount

        // Calculate percentage filled
        const percentageFilled = Math.round((confirmedCount / capacity) * 100)

        return {
          id: event.event_id,
          title: event.title,
          date: event.date,
          capacity: capacity,
          confirmedCount: confirmedCount,
          waitlistedCount: waitlistedCount,
          canceledCount: canceledCount,
          percentageFilled: percentageFilled,
          availableSpots: Math.max(0, capacity - confirmedCount),
        }
      })

      // Format recent activity
      const formattedActivity = recentActivity.map((activity) => ({
        id: activity.id,
        action: activity.action,
        note: activity.note,
        createdAt: activity.createdAt,
        user: {
          name: activity.user_name,
        },
        event: {
          title: activity.event_title,
        },
      }))

      // Summary analytics
      const summaryAnalytics = {
        totalEvents,
        totalConfirmedBookings,
        totalWaitlistedBookings,
        totalCanceledBookings,
        totalBookings: totalConfirmedBookings + totalWaitlistedBookings + totalCanceledBookings,
        averageCapacityUtilization:
          totalEvents > 0
            ? Math.round(
                (totalConfirmedBookings / eventsData.reduce((sum, event) => sum + Number.parseInt(event.capacity), 0)) *
                  100,
              )
            : 0,
      }

      return res.status(200).json({
        success: true,
        data: {
          upcomingEvents,
          summaryAnalytics,
          recentActivity: formattedActivity,
          generatedAt: new Date().toISOString(),
        },
      })
    } catch (error) {
      console.error("Dashboard error:", error)

      return res.status(500).json({
        success: false,
        error: "Failed to load dashboard data. Please try again.",
      })
    }
  },
}

module.exports = dashboardEndpoint
