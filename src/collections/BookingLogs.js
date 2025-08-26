const { tenantAccess } = require("../utils/access")

const BookingLogs = {
  slug: "booking-logs", // Make sure this matches the collection name used in your code
  admin: {
    useAsTitle: "action",
    defaultColumns: ["action", "user", "event", "createdAt"],
    listSearchableFields: ["action", "note"],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false

      // Extract tenant ID properly
      const tenantId = typeof user.tenant === "object" && user.tenant !== null ? user.tenant.id : user.tenant

      // Admin can see all logs in their tenant
      if (user.role === "admin") {
        return {
          tenant: {
            equals: tenantId,
          },
        }
      }

      // Organizers can see logs for their events
      if (user.role === "organizer") {
        return {
          and: [
            {
              tenant: {
                equals: tenantId,
              },
            },
            {
              "event.organizer": {
                equals: user.id,
              },
            },
          ],
        }
      }

      // Attendees can see logs for their own bookings
      return {
        and: [
          {
            tenant: {
              equals: tenantId,
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
      // Only system can create logs (through hooks)
      return user && (user.role === "admin" || user.role === "organizer")
    },
    update: () => false, // Logs should be immutable
    delete: ({ req: { user } }) => {
      // Only admins can delete logs
      return user && user.role === "admin"
    },
  },
  fields: [
    {
      name: "booking",
      type: "relationship",
      relationTo: "bookings",
      required: true,
      filterOptions: ({ user }) => {
        if (!user) return false

        const tenantId = typeof user.tenant === "object" && user.tenant !== null ? user.tenant.id : user.tenant

        return {
          tenant: {
            equals: tenantId,
          },
        }
      },
    },
    {
      name: "event",
      type: "relationship",
      relationTo: "events",
      required: true,
      filterOptions: ({ user }) => {
        if (!user) return false

        const tenantId = typeof user.tenant === "object" && user.tenant !== null ? user.tenant.id : user.tenant

        return {
          tenant: {
            equals: tenantId,
          },
        }
      },
    },
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      required: true,
      filterOptions: ({ user }) => {
        if (!user) return false

        const tenantId = typeof user.tenant === "object" && user.tenant !== null ? user.tenant.id : user.tenant

        return {
          tenant: {
            equals: tenantId,
          },
        }
      },
    },
    {
      name: "action",
      type: "select",
      required: true,
      options: [
        {
          label: "Create Request",
          value: "create_request",
        },
        {
          label: "Auto Waitlist",
          value: "auto_waitlist",
        },
        {
          label: "Auto Confirm",
          value: "auto_confirm",
        },
        {
          label: "Promote from Waitlist",
          value: "promote_from_waitlist",
        },
        {
          label: "Cancel Confirmed",
          value: "cancel_confirmed",
        },
      ],
    },
    {
      name: "note",
      type: "textarea",
      required: true,
      maxLength: 500,
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
        // Auto-assign tenant for new logs
        if (operation === "create" && req.user && !data.tenant) {
          const tenantId = typeof req.user.tenant === "object" && req.user.tenant !== null ? req.user.tenant.id : req.user.tenant
          data.tenant = tenantId
        }
        return data
      },
    ],
  },
  timestamps: true,
}

module.exports = BookingLogs