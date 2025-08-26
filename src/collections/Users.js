const { isAdmin, isSameTenant } = require("../utils/access")

const Users = {
  slug: "users",
  auth: {
    tokenExpiration: 7200, // 2 hours
  },
  admin: {
    useAsTitle: "email",
    defaultColumns: ["name", "email", "role", "tenant"],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false

      const tenantId = typeof user.tenant === "object" && user.tenant !== null ? user.tenant.id : user.tenant

      // Admin can see all users in their tenant
      if (user.role === "admin") {
        return {
          tenant: {
            equals: tenantId,
          },
        }
      }

      // Organizers can see users in their tenant
      if (user.role === "organizer") {
        return {
          tenant: {
            equals: tenantId,
          },
        }
      }

      // Attendees can only see themselves
      return {
        id: {
          equals: user.id,
        },
      }
    },
    create: () => true,
    update: ({ req: { user }, id }) => {
      if (!user) return false

      // Users can update themselves
      if (user.id === id) return true

      // Admins can update users in their tenant
      return isAdmin(user) && isSameTenant(user)
    },
    delete: ({ req: { user } }) => {
      // Only admins can delete users
      return isAdmin(user)
    },
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
    },
    {
      name: "email",
      type: "email",
      required: true,
      unique: true,
    },
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "attendee",
      options: [
        {
          label: "Attendee",
          value: "attendee",
        },
        {
          label: "Organizer",
          value: "organizer",
        },
        {
          label: "Admin",
          value: "admin",
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
    beforeChange: [
      ({ req, operation, data }) => {
        // Tenant assignment is now handled in the registration endpoint
        return data
      },
    ],
    afterRead: [
      ({ doc, req, context }) => {
        // If this is for authentication context, ensure tenant is just an ID
        if (doc && doc.tenant && typeof doc.tenant === "object" && doc.tenant.id) {
          doc.tenant = doc.tenant.id
        }
        return doc
      },
    ],
  },
  timestamps: true,
}

module.exports = Users
