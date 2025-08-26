const Tenants = {
  slug: "tenants",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "createdAt"],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false

      // Admin can see all tenants
      if (user.role === "admin") return true

      // Users can only see their own tenant
      return {
        id: {
          equals: user.tenant,
        },
      }
    },
    create: ({ req: { user } }) => {
      // Only admins can create tenants
      return user && user.role === "admin"
    },
    update: ({ req: { user } }) => {
      // Only admins can update tenants
      return user && user.role === "admin"
    },
    delete: ({ req: { user } }) => {
      // Only admins can delete tenants
      return user && user.role === "admin"
    },
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      unique: true,
    },
  ],
  timestamps: true,
}

module.exports = Tenants
