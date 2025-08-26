const registerEndpoint = {
  path: "/register",
  method: "post",
  handler: async (req, res) => {
    try {
      const { name, email, password, role = "attendee", tenantName, tenantId } = req.body

      // Validate required fields
      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: "Name, email, and password are required",
        })
      }

      const validRoles = ["attendee", "organizer", "admin"]
      if (!validRoles.includes(role)) {
        let suggestion = ""
        if (role === "addmin") {
          suggestion = " Did you mean 'admin'?"
        } else if (role === "organiser") {
          suggestion = " Did you mean 'organizer'?"
        }

        return res.status(400).json({
          success: false,
          message: `Invalid role '${role}'. Must be one of: attendee, organizer, admin.${suggestion}`,
          errors: [
            {
              field: "role",
              message: `This field has an invalid selection. Valid options: ${validRoles.join(", ")}`,
            },
          ],
        })
      }

      const isAuthenticated = req.user && req.user.role
      const isAdminCreatingAttendee = isAuthenticated && req.user.role === "admin" && role === "attendee"

      if ((role === "organizer" || role === "admin") && !tenantName) {
        return res.status(400).json({
          success: false,
          message: "Tenant name is required for organizers and admins",
          errors: [
            {
              field: "tenant",
              message: "This field is required.",
            },
          ],
        })
      }

      if (role === "attendee" && !isAdminCreatingAttendee && !tenantName) {
        return res.status(400).json({
          success: false,
          message: "Attendees must be invited by an organizer. Please contact your organization admin.",
          errors: [
            {
              field: "tenant",
              message: "This field is required.",
            },
          ],
        })
      }

      // Check if email already exists
      const existingUser = await req.payload.find({
        collection: "users",
        where: {
          email: {
            equals: email,
          },
        },
        limit: 1,
      })

      if (existingUser.docs.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Email already exists. Please use a different email or login instead.",
        })
      }

      let finalTenantId = null

      if (role === "organizer" || role === "admin") {
        // Create new tenant for organizers and admins
        const tenantResult = await req.payload.create({
          collection: "tenants",
          data: {
            name: tenantName,
          },
        })
        finalTenantId = tenantResult.id
      } else if (role === "attendee") {
        if (isAdminCreatingAttendee && tenantId) {
          // Admin creating attendee for their tenant using tenantId
          const adminTenantId = typeof req.user.tenant === "object" ? req.user.tenant.id : req.user.tenant
          if (Number.parseInt(tenantId) === Number.parseInt(adminTenantId)) {
            finalTenantId = adminTenantId
          } else {
            return res.status(403).json({
              success: false,
              message: "You can only create attendees for your own tenant.",
            })
          }
        } else if (tenantName) {
          // Find existing tenant by name
          const existingTenant = await req.payload.find({
            collection: "tenants",
            where: {
              name: {
                equals: tenantName,
              },
            },
            limit: 1,
          })

          if (existingTenant.docs.length === 0) {
            return res.status(400).json({
              success: false,
              message: "Organization not found. Please contact your organization admin.",
            })
          }

          finalTenantId = existingTenant.docs[0].id
        }
      }

      if (!finalTenantId) {
        return res.status(400).json({
          success: false,
          message: "Tenant assignment failed",
          errors: [
            {
              field: "tenant",
              message: "This field is required.",
            },
          ],
        })
      }

      const userData = {
        name,
        email,
        password,
        role,
        tenant: finalTenantId,
      }

      const user = await req.payload.create({
        collection: "users",
        data: userData,
      })

      const loginResult = await req.payload.login({
        collection: "users",
        data: {
          email,
          password,
        },
        req,
        res,
      })

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenant: user.tenant,
        },
        token: loginResult.token,
      })
    } catch (error) {
      console.error("Registration error:", error)

      if (error.name === "ValidationError" && error.data) {
        const formattedErrors = error.data.map((err) => ({
          field: err.field || "unknown",
          message: err.message || "Invalid value",
        }))

        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: formattedErrors,
        })
      }

      // Handle other duplicate key errors
      if (error.message.includes("duplicate key") || error.message.includes("unique")) {
        return res.status(400).json({
          success: false,
          message: "Email already exists. Please use a different email or login instead.",
        })
      }

      res.status(500).json({
        success: false,
        message: "Registration failed",
        error: error.message,
      })
    }
  },
}

module.exports = registerEndpoint
