const { tenantAccess } = require("../utils/access")

const Notifications = {
  slug: "notifications",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "user", "type", "read", "createdAt"],
    listSearchableFields: ["title", "message"],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false

      // Admin can see all notifications in their tenant
      if (user.role === "admin") {
        return {
          tenant: {
            equals: user.tenant,
          },
        }
      }

      // Organizers can see notifications for users in their tenant
      if (user.role === "organizer") {
        return {
          tenant: {
            equals: user.tenant,
          },
        }
      }

      // Attendees can only see their own notifications
      return {
        and: [
          {
            tenant: {
              equals: user.tenant,
            },
          },
          {
            user: {
              equals: user.id,
            },
          },
        ],
      }
    },
    create: ({ req: { user } }) => {
      // Only system can create notifications (through hooks)
      return user && (user.role === "admin" || user.role === "organizer")
    },
    update: ({ req: { user } }) => {
      if (!user) return false

      // Admin can update any notification in their tenant
      if (user.role === "admin") {
        return {
          tenant: {
            equals: user.tenant,
          },
        }
      }

      // Users can only update their own notifications (mark as read)
      return {
        and: [
          {
            tenant: {
              equals: user.tenant,
            },
          },
          {
            user: {
              equals: user.id,
            },
          },
        ],
      }
    },
    delete: ({ req: { user } }) => {
      // Only admins can delete notifications
      return user && user.role === "admin"
    },
  },
  fields: [
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      required: true,
      filterOptions: ({ user }) => {
        if (!user) return false

        return {
          tenant: {
            equals: user.tenant,
          },
        }
      },
    },
    {
      name: "booking",
      type: "relationship",
      relationTo: "bookings",
      required: true,
      filterOptions: ({ user }) => {
        if (!user) return false

        return {
          tenant: {
            equals: user.tenant,
          },
        }
      },
    },
    {
      name: "type",
      type: "select",
      required: true,
      options: [
        {
          label: "Booking Confirmed",
          value: "booking_confirmed",
        },
        {
          label: "Waitlisted",
          value: "waitlisted",
        },
        {
          label: "Waitlist Promoted",
          value: "waitlist_promoted",
        },
        {
          label: "Booking Canceled",
          value: "booking_canceled",
        },
      ],
    },
    {
      name: "title",
      type: "text",
      required: true,
      maxLength: 100,
    },
    {
      name: "message",
      type: "textarea",
      required: true,
      maxLength: 500,
    },
    {
      name: "read",
      type: "checkbox",
      defaultValue: false,
    },
    {
      name: "tenant",
      type: "relationship",
      relationTo: "tenants",
      required: true,
      admin: {
        position: "sidebar",
      },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ req, operation, data }) => {
        // Auto-assign tenant for new notifications
        if (operation === "create" && req.user && !data.tenant) {
          data.tenant = req.user.tenant
        }
        return data
      },
    ],
  },
  timestamps: true,
}

module.exports = Notifications
