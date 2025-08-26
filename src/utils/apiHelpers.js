// API helper utilities for common operations

const validatePagination = (page, limit, maxLimit = 100) => {
  const pageNum = Number.parseInt(page, 10) || 1
  const limitNum = Number.parseInt(limit, 10) || 10

  if (pageNum < 1) {
    throw new Error("Page must be greater than 0")
  }

  if (limitNum < 1 || limitNum > maxLimit) {
    throw new Error(`Limit must be between 1 and ${maxLimit}`)
  }

  return { page: pageNum, limit: limitNum }
}

const formatErrorResponse = (error, defaultMessage = "An error occurred") => {
  console.error("API Error:", error)

  // Handle known error types
  if (error.message.includes("not found")) {
    return {
      status: 404,
      response: {
        success: false,
        error: error.message,
      },
    }
  }

  if (error.message.includes("Access denied") || error.message.includes("Unauthorized")) {
    return {
      status: 403,
      response: {
        success: false,
        error: error.message,
      },
    }
  }

  if (error.message.includes("already") || error.message.includes("Invalid")) {
    return {
      status: 400,
      response: {
        success: false,
        error: error.message,
      },
    }
  }

  // Default server error
  return {
    status: 500,
    response: {
      success: false,
      error: defaultMessage,
    },
  }
}

const validateAuthentication = (req) => {
  if (!req.user) {
    throw new Error("Authentication required")
  }

  if (!req.user.tenant) {
    throw new Error("User tenant not found")
  }

  return {
    userId: req.user.id,
    userTenant: req.user.tenant,
    userRole: req.user.role,
  }
}

const validateRole = (user, allowedRoles) => {
  if (!allowedRoles.includes(user.role)) {
    throw new Error(`Access denied. Required roles: ${allowedRoles.join(", ")}`)
  }
}

const sanitizeId = (id, fieldName = "ID") => {
  if (!id || typeof id !== "string" || id.length < 1) {
    throw new Error(`Invalid ${fieldName} format`)
  }
  return id.trim()
}

module.exports = {
  validatePagination,
  formatErrorResponse,
  validateAuthentication,
  validateRole,
  sanitizeId,
}
