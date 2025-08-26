const { tenantAccess } = require("../utils/access")
const {
  handleBookingCreation,
  handleBookingStatusChange,
  handleWaitlistPromotion,
  validateBookingUpdate,
  validateEventCapacity,
} = require("../hooks/bookingHooks")

const Bookings = {
  slug: "bookings",
  admin: {
    useAsTitle: "id",
    defaultColumns: ["event", "user", "status", "createdAt"],
    listSearchableFields: ["user", "event"],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false

      // Extract tenant ID properly
      const tenantId = typeof user.tenant === "object" && user.tenant !== null ? user.tenant.id : user.tenant

      // Admin can see all bookings in their tenant
      if (user.role === "admin") {
        return {
          tenant: {
            equals: tenantId,
          },
        }
      }

      // Organizers can see bookings for their events
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

      // Attendees can only see their own bookings
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
      // Only authenticated users can create bookings
      return !!user
    },
    update: ({ req: { user } }) => {
      if (!user) return false

      // Extract tenant ID properly
      const tenantId = typeof user.tenant === "object" && user.tenant !== null ? user.tenant.id : user.tenant

      // Admin can update any booking in their tenant
      if (user.role === "admin") {
        return {
          tenant: {
            equals: tenantId,
          },
        }
      }

      // Organizers can update bookings for their events
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

      // Attendees can only cancel their own bookings
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
    delete: ({ req: { user } }) => {
      // Only admins can delete bookings
      return user && user.role === "admin"
    },
  },
  fields: [
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
      name: "status",
      type: "select",
      required: true,
      defaultValue: "confirmed",
      options: [
        {
          label: "Confirmed",
          value: "confirmed",
        },
        {
          label: "Waitlisted",
          value: "waitlisted",
        },
        {
          label: "Canceled",
          value: "canceled",
        },
      ],
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
      async ({ req, operation, data }) => {
        // Auto-assign tenant for new bookings
        if (operation === "create" && req.user && !data.tenant) {
          const tenantId = typeof req.user.tenant === "object" && req.user.tenant !== null ? req.user.tenant.id : req.user.tenant
          data.tenant = tenantId
        }

        // Auto-assign user for new bookings
        if (operation === "create" && req.user && !data.user) {
          data.user = req.user.id
        }

        return data
      },
    ],
    beforeChange: [
      // Handle booking creation logic
      async ({ req, operation, data, originalDoc }) => {
        if (operation === "create") {
          return await handleBookingCreation({ req, data })
        }

        if (operation === "update") {
          await validateBookingUpdate({ req, data, originalDoc })
          await validateEventCapacity({ req, data, originalDoc, operation })
        }

        return data
      },
    ],
    afterChange: [
      // Handle notifications and logging FIRST
      async ({ req, operation, doc, previousDoc }) => {
        await handleBookingStatusChange({ req, doc, previousDoc, operation })
      },
      // Handle waitlist promotion SEPARATELY with a small delay
      async ({ req, operation, doc, previousDoc }) => {
        if (operation === "update" && previousDoc?.status === "confirmed" && doc.status === "canceled") {
          // Use setTimeout to ensure this runs after the main transaction is committed
          setTimeout(async () => {
            try {
              await handleWaitlistPromotion({ req, doc, previousDoc })
            } catch (error) {
              console.error("Waitlist promotion failed:", error)
            }
          }, 500)
        }
      },
    ],
  },
  timestamps: true,
}

module.exports = Bookings