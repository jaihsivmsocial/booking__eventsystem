const payload = require("payload")

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

const createNotification = async (userId, bookingId, type, title, message, tenant) => {
  try {
    console.log("Raw notification values:", { userId, bookingId, type, title, message, tenant })

    const userIdInt = extractId(userId)
    const bookingIdInt = extractId(bookingId)
    const tenantIdInt = extractId(tenant)

    console.log("Extracted notification IDs:", { userIdInt, bookingIdInt, tenantIdInt })

    const cleanData = {
      user: userIdInt,
      booking: bookingIdInt,
      type: String(type).trim(),
      title: String(title).trim(),
      message: String(message).trim(),
      read: false,
      tenant: tenantIdInt,
    }

    console.log("Clean notification data:", cleanData)

    const notification = await payload.create({
      collection: "notifications",
      data: cleanData,
    })

    console.log(`Notification created: ${notification.id} for user: ${userIdInt}`)
    return notification
  } catch (error) {
    console.error("Error creating notification:", error)
    throw error
  }
}

const createBookingLog = async (bookingId, eventId, userId, action, note, tenant) => {
  try {
    const bookingIdInt = extractId(bookingId)
    const eventIdInt = extractId(eventId)
    const userIdInt = extractId(userId)
    const tenantIdInt = extractId(tenant)

    const log = await payload.create({
      collection: "booking-logs",
      data: {
        booking: bookingIdInt,
        event: eventIdInt,
        user: userIdInt,
        action,
        note,
        tenant: tenantIdInt,
      },
    })

    console.log(`Booking log created: ${log.id} for booking: ${bookingIdInt}`)
    return log
  } catch (error) {
    console.error("Error creating booking log:", error)
    throw error
  }
}

const getNotificationContent = (type, eventTitle) => {
  const content = {
    booking_confirmed: {
      title: "Booking Confirmed! 🎉",
      message: `Great news! Your booking for "${eventTitle}" has been confirmed. We look forward to seeing you there!`,
    },
    waitlisted: {
      title: "Added to Waitlist ⏳",
      message: `You've been added to the waitlist for "${eventTitle}". We'll notify you immediately if a spot opens up.`,
    },
    waitlist_promoted: {
      title: "Promoted from Waitlist! 🎉",
      message: `Excellent news! A spot opened up and your booking for "${eventTitle}" is now confirmed. See you there!`,
    },
    booking_canceled: {
      title: "Booking Canceled ❌",
      message: `Your booking for "${eventTitle}" has been canceled. If this was a mistake, please contact the organizer.`,
    },
  }

  return content[type] || { title: "Booking Update", message: "Your booking status has been updated." }
}

// Mark notification as read
const markNotificationAsRead = async (notificationId, userId, tenant) => {
  try {
    const notificationIdInt = extractId(notificationId)
    const userIdInt = extractId(userId)
    const tenantIdInt = extractId(tenant)

    const notification = await payload.update({
      collection: "notifications",
      id: notificationIdInt,
      data: {
        read: true,
      },
      where: {
        and: [
          {
            id: {
              equals: notificationIdInt,
            },
          },
          {
            user: {
              equals: userIdInt,
            },
          },
          {
            tenant: {
              equals: tenantIdInt,
            },
          },
        ],
      },
    })

    return notification
  } catch (error) {
    console.error("Error marking notification as read:", error)
    throw error
  }
}

// Get unread notification count with better error handling
const getUnreadNotificationCount = async (userId, tenant) => {
  try {
    const userIdInt = extractId(userId)
    const tenantIdInt = extractId(tenant)

    // Method 1: Try using find with pagination to get count
    const result = await payload.find({
      collection: "notifications",
      where: {
        and: [
          {
            user: {
              equals: userIdInt,
            },
          },
          {
            tenant: {
              equals: tenantIdInt,
            },
          },
          {
            read: {
              equals: false,
            },
          },
        ],
      },
      page: 1,
      limit: 1, // We only need the count, not the data
    })

    return result.totalDocs || 0
  } catch (error) {
    console.error("Error getting unread notification count:", error)
    
    // Fallback: get all and count manually
    try {
      const userIdInt = extractId(userId)
      const tenantIdInt = extractId(tenant)
      
      const allUnread = await payload.find({
        collection: "notifications",
        where: {
          and: [
            {
              user: {
                equals: userIdInt,
              },
            },
            {
              tenant: {
                equals: tenantIdInt,
              },
            },
            {
              read: {
                equals: false,
              },
            },
          ],
        },
        limit: 1000,
      })
      
      return allUnread.docs ? allUnread.docs.length : 0
    } catch (fallbackError) {
      console.error("Fallback count method also failed:", fallbackError)
      return 0
    }
  }
}

module.exports = {
  createNotification,
  createBookingLog,
  getNotificationContent,
  markNotificationAsRead,
  getUnreadNotificationCount,
}