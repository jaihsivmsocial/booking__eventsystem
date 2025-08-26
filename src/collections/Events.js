const { isSameTenant, isOrganizerOrAdmin } = require("../utils/access")

const Events = {
  slug: "events",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "date", "capacity", "organizer"],
    listSearchableFields: ["title", "description"],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false

      // Extract tenant ID properly
      const tenantId = typeof user.tenant === "object" && user.tenant !== null ? user.tenant.id : user.tenant

      // Users can only see events in their tenant
      return {
        tenant: {
          equals: tenantId,
        },
      }
    },
    create: ({ req: { user } }) => {
      // Only organizers and admins can create events
      return user && isOrganizerOrAdmin(user)
    },
    update: ({ req: { user } }) => {
      if (!user) return false

      // Extract tenant ID properly
      const tenantId = typeof user.tenant === "object" && user.tenant !== null ? user.tenant.id : user.tenant

      // Admins can update any event in their tenant
      if (user.role === "admin") {
        return {
          tenant: {
            equals: tenantId,
          },
        }
      }

      // Organizers can only update their own events
      if (user.role === "organizer") {
        return {
          and: [
            {
              tenant: {
                equals: tenantId,
              },
            },
            {
              organizer: {
                equals: user.id,
              },
            },
          ],
        }
      }

      return false
    },
    delete: ({ req: { user } }) => {
      return user && isOrganizerOrAdmin(user)
    },
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      maxLength: 200,
    },
    {
      name: "description",
      type: "richText",
      required: true,
    },
    {
      name: "date",
      type: "date",
      required: true,
      admin: {
        date: {
          pickerAppearance: "dayAndTime",
        },
      },
      validate: (val) => {
        const eventDate = new Date(val)
        const now = new Date()

        if (eventDate <= now) {
          return "Event date must be in the future"
        }

        return true
      },
    },
    {
      name: "capacity",
      type: "number",
      required: true,
      min: 1,
      max: 10000,
      validate: (val) => {
        if (val < 1) {
          return "Capacity must be at least 1"
        }
        if (val > 10000) {
          return "Capacity cannot exceed 10,000"
        }
        return true
      },
    },
    {
      name: "organizer",
      type: "relationship",
      relationTo: "users",
      required: true,
      filterOptions: ({ user }) => {
        if (!user) return false

        const tenantId = typeof user.tenant === "object" && user.tenant !== null ? user.tenant.id : user.tenant

        return {
          and: [
            {
              tenant: {
                equals: tenantId,
              },
            },
            {
              role: {
                in: ["organizer", "admin"],
              },
            },
          ],
        }
      },
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
    // Virtual field to show booking counts
    {
      name: "bookingCounts",
      type: "json",
      admin: {
        readOnly: true,
        position: "sidebar",
      },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ req, operation, data }) => {
        // Auto-assign tenant and organizer for new events
        if (operation === "create" && req.user) {
          if (!data.tenant) {
            const tenantId = typeof req.user.tenant === "object" && req.user.tenant !== null ? req.user.tenant.id : req.user.tenant
            data.tenant = tenantId
          }
          if (!data.organizer) {
            data.organizer = req.user.id
          }
        }
        return data
      },
    ],
    beforeChange: [
      async ({ req, operation, data, originalDoc }) => {
        // Prevent capacity reduction if it would affect confirmed bookings
        if (operation === "update" && originalDoc && data.capacity < originalDoc.capacity) {
          const { getBookingCounts } = require("../utils/database")
          
          // Extract tenant ID properly
          const tenantId = typeof data.tenant === "object" && data.tenant !== null ? data.tenant.id : data.tenant
          
          const counts = await getBookingCounts(originalDoc.id, tenantId)

          if (data.capacity < counts.confirmed) {
            throw new Error(`Cannot reduce capacity below ${counts.confirmed} (current confirmed bookings)`)
          }
        }

        return data
      },
    ],
    afterRead: [
      async ({ doc, req }) => {
        // Add booking counts to the document
        if (doc && req.user) {
          try {
            const { getBookingCounts } = require("../utils/database")
            
            // Extract tenant ID properly
            const tenantId = typeof doc.tenant === "object" && doc.tenant !== null ? doc.tenant.id : doc.tenant
            
            const counts = await getBookingCounts(doc.id, tenantId)
            doc.bookingCounts = counts
          } catch (error) {
            console.error("Error getting booking counts:", error)
            doc.bookingCounts = { confirmed: 0, waitlisted: 0, canceled: 0 }
          }
        }
        return doc
      },
    ],
  },
  timestamps: true,
}

module.exports = Events