const isAdmin = (user) => {
  return user && user.role === "admin"
}

const isOrganizer = (user) => {
  return user && user.role === "organizer"
}

const isOrganizerOrAdmin = (user) => {
  return user && (user.role === "organizer" || user.role === "admin")
}

const isSameTenant = (user, doc) => {
  if (!user || !doc) return false

  const userTenantId = typeof user.tenant === "object" && user.tenant !== null ? user.tenant.id : user.tenant
  const docTenantId = typeof doc.tenant === "object" && doc.tenant !== null ? doc.tenant.id : doc.tenant

  return userTenantId === docTenantId
}

const tenantAccess = ({ req: { user } }) => {
  if (!user) return false

  const tenantId = typeof user.tenant === "object" && user.tenant !== null ? user.tenant.id : user.tenant

  return {
    tenant: {
      equals: tenantId,
    },
  }
}

module.exports = {
  isAdmin,
  isOrganizer,
  isOrganizerOrAdmin,
  isSameTenant,
  tenantAccess,
}
