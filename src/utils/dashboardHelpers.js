// Helper functions for dashboard calculations and formatting

const calculateEventMetrics = (events) => {
  return events.map((event) => {
    const confirmedCount = Number.parseInt(event.confirmed_count) || 0
    const waitlistedCount = Number.parseInt(event.waitlisted_count) || 0
    const canceledCount = Number.parseInt(event.canceled_count) || 0
    const capacity = Number.parseInt(event.capacity) || 1

    const percentageFilled = Math.round((confirmedCount / capacity) * 100)
    const availableSpots = Math.max(0, capacity - confirmedCount)

    return {
      ...event,
      confirmedCount,
      waitlistedCount,
      canceledCount,
      capacity,
      percentageFilled,
      availableSpots,
      isFullyBooked: confirmedCount >= capacity,
      hasWaitlist: waitlistedCount > 0,
    }
  })
}

const calculateSummaryStats = (events) => {
  const totalEvents = events.length
  let totalConfirmed = 0
  let totalWaitlisted = 0
  let totalCanceled = 0
  let totalCapacity = 0

  events.forEach((event) => {
    totalConfirmed += Number.parseInt(event.confirmed_count) || 0
    totalWaitlisted += Number.parseInt(event.waitlisted_count) || 0
    totalCanceled += Number.parseInt(event.canceled_count) || 0
    totalCapacity += Number.parseInt(event.capacity) || 0
  })

  const averageCapacityUtilization = totalCapacity > 0 ? Math.round((totalConfirmed / totalCapacity) * 100) : 0

  return {
    totalEvents,
    totalConfirmedBookings: totalConfirmed,
    totalWaitlistedBookings: totalWaitlisted,
    totalCanceledBookings: totalCanceled,
    totalBookings: totalConfirmed + totalWaitlisted + totalCanceled,
    totalCapacity,
    averageCapacityUtilization,
  }
}

const formatActivityFeed = (activities) => {
  return activities.map((activity) => ({
    ...activity,
    actionLabel: getActionLabel(activity.action),
    actionColor: getActionColor(activity.action),
    actionIcon: getActionIcon(activity.action),
    timeAgo: formatRelativeTime(activity.createdAt),
  }))
}

const getActionLabel = (action) => {
  const labels = {
    create_request: "Booking Request",
    auto_waitlist: "Added to Waitlist",
    auto_confirm: "Booking Confirmed",
    promote_from_waitlist: "Promoted from Waitlist",
    cancel_confirmed: "Booking Canceled",
  }
  return labels[action] || "Unknown Action"
}

const getActionColor = (action) => {
  const colors = {
    create_request: "text-blue-600",
    auto_waitlist: "text-yellow-600",
    auto_confirm: "text-green-600",
    promote_from_waitlist: "text-emerald-600",
    cancel_confirmed: "text-red-600",
  }
  return colors[action] || "text-gray-600"
}

const getActionIcon = (action) => {
  const icons = {
    create_request: "📝",
    auto_waitlist: "⏳",
    auto_confirm: "✅",
    promote_from_waitlist: "⬆️",
    cancel_confirmed: "❌",
  }
  return icons[action] || "📋"
}

const formatRelativeTime = (dateString) => {
  const now = new Date()
  const date = new Date(dateString)
  const diffInMinutes = Math.floor((now - date) / (1000 * 60))

  if (diffInMinutes < 1) return "Just now"
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
  return `${Math.floor(diffInMinutes / 1440)}d ago`
}

const getCapacityStatus = (confirmed, capacity) => {
  const percentage = (confirmed / capacity) * 100

  if (percentage >= 100) return { status: "full", color: "red", label: "Full" }
  if (percentage >= 90) return { status: "nearly-full", color: "orange", label: "Nearly Full" }
  if (percentage >= 70) return { status: "filling", color: "yellow", label: "Filling Up" }
  return { status: "available", color: "green", label: "Available" }
}

module.exports = {
  calculateEventMetrics,
  calculateSummaryStats,
  formatActivityFeed,
  getActionLabel,
  getActionColor,
  getActionIcon,
  formatRelativeTime,
  getCapacityStatus,
}
