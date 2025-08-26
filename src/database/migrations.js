const { getPool } = require("./connection")

// Create indexes for better performance
const createIndexes = async () => {
  const pool = getPool()

  try {
    // Tenant-based indexes for multi-tenancy performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant);
      CREATE INDEX IF NOT EXISTS idx_events_tenant ON events(tenant);
      CREATE INDEX IF NOT EXISTS idx_bookings_tenant ON bookings(tenant);
      CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant);
      CREATE INDEX IF NOT EXISTS idx_booking_logs_tenant ON "booking-logs"(tenant);
    `)

    // Performance indexes for common queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_bookings_event_status ON bookings(event, status);
      CREATE INDEX IF NOT EXISTS idx_bookings_user_status ON bookings(user, status);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user, read);
      CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
      CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings("createdAt");
    `)

    // Unique constraints for business logic
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_user_event_unique 
      ON bookings(user, event) 
      WHERE status != 'canceled';
    `)

    console.log("Database indexes created successfully")
  } catch (error) {
    console.error("Error creating indexes:", error)
  }
}

// Create triggers for automatic tenant assignment
const createTriggers = async () => {
  const pool = getPool()

  try {
    // Function to automatically set tenant from user context
    await pool.query(`
      CREATE OR REPLACE FUNCTION set_tenant_from_user()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.tenant IS NULL AND current_setting('app.current_user_tenant', true) IS NOT NULL THEN
          NEW.tenant := current_setting('app.current_user_tenant')::integer;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `)

    console.log("Database triggers created successfully")
  } catch (error) {
    console.error("Error creating triggers:", error)
  }
}

// Run all migrations
const runMigrations = async () => {
  console.log("Running database migrations...")
  await createIndexes()
  await createTriggers()
  console.log("Database migrations completed")
}

module.exports = {
  createIndexes,
  createTriggers,
  runMigrations,
}
