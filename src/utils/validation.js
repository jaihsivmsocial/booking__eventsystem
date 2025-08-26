// Validation utilities for the booking system

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const validatePassword = (password) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/
  return passwordRegex.test(password)
}

const validateEventDate = (date) => {
  const eventDate = new Date(date)
  const now = new Date()

  // Event must be at least 1 hour in the future
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)

  return eventDate > oneHourFromNow
}

const validateCapacity = (capacity) => {
  return Number.isInteger(capacity) && capacity >= 1 && capacity <= 10000
}

const sanitizeInput = (input) => {
  if (typeof input !== "string") return input

  // Remove potentially dangerous characters
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim()
}

const validateTenantAccess = (userTenant, resourceTenant) => {
  return userTenant && resourceTenant && userTenant.toString() === resourceTenant.toString()
}

module.exports = {
  validateEmail,
  validatePassword,
  validateEventDate,
  validateCapacity,
  sanitizeInput,
  validateTenantAccess,
}
