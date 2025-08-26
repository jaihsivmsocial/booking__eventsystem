# Event Booking System

A comprehensive multi-tenant event booking system built with PayloadCMS, PostgreSQL, and Express.js. Features automated waitlist management, real-time notifications, and role-based access control.

## 🌟 Features

###  **Event Management**
- Create and manage events with capacity limits
- Automated booking status management (confirmed/waitlisted/canceled)
- Multi-tenant isolation for organizations
- Real-time capacity tracking

###  **User Management**
- Role-based access control (Admin, Organizer, Attendee)
- Multi-tenant user isolation
- Secure authentication with JWT tokens
- User registration with tenant assignment

###  **Booking System**
- Automatic waitlist management
- Smart promotion from waitlist when spots open
- Booking cancellation with automatic promotion
- Duplicate booking prevention

###  **Notification System**
- Real-time booking status notifications
- Waitlist promotion alerts
- Email-ready notification content
- Mark notifications as read functionality

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **PostgreSQL** database (NeonDB)
- **npm** 

### 1. Installation

```bash
# Clone the repository
git clone <repository-url>
cd bookingEvent/Backend

# Install dependencies
npm install
```

### 2. Environment Setup

Create a `.env` file in the Backend directory:

```env
# Database Configuration
 Database
DATABASE_URL="postgresql://neondb_owner:npg_dL2oiyKGkB0f@ep-sweet-dream-adxq41ck-pooler.c-2.us-east-1.aws.neon.tech/event_booking_db?sslmode=require&channel_binding=require"

# Payload CMS Configuration
PAYLOAD_SECRET="da70297e34dac0992a260df24ed6bffdef01afd708f4a013eba2049b131e5ff8"
PAYLOAD_PUBLIC_SERVER_URL="http://localhost:3000"

# Server Configuration
PORT=3000
NODE_ENV=development


# Email (optional)
EMAIL_HOST=smtp-mail.gmail.com
EMAIL_PORT=587
EMAIL_USER=jaishivkumar1999@gmail.com
EMAIL_PASSWORD=scyz eskz lmov lobe

# JWT
JWT_SECRET=your-jwt-secret-key
```

### 3. Database Setup

```bash
# The system will automatically create tables on first run
# Ensure your PostgreSQL database exists and is accessible

# Test database connection
npm run test-db
```

### 4. Start Development Server

```bash
# Start the development server with auto-reload
npm run dev

# Server will start at http://localhost:3000
```


```

### User Management

#### Register User
```http
POST /api/register
Content-Type: application/json

{
  "name": "jaishivkumar",
  "email": "jaishiv@example.com",
  "password": "password@123",
  "role": "attendee",
  "tenantName": "TechCorp Solutions"
}
```

#### Login
```http
POST /api/users/login
Content-Type: application/json

{
   "email": "jaishiv@example.com",
  "password": "password@123",
}
```

### **Step 1: User Registration & Authentication**

#### **1.1 Register Admin/Organizer (No Token Required)**
\`\`\`
POST http://localhost:3000/api/register
Content-Type: application/json

{
  "name": "John Admin",
  "email": "admin@techcorp.com",
  "password": "password123",
  "role": "admin",
  "tenantName": "TechCorp Solutions"
}
\`\`\`
**Expected Response:** `201 Created` with user data and JWT token
**Token Usage:** Save the JWT token for admin operations

#### **1.2 Register Second Tenant (No Token Required)**
\`\`\`
POST http://localhost:3000/api/register
Content-Type: application/json

{
  "name": "Sarah Organizer",
  "email": "organizer@innovate.com", 
  "password": "password123",
  "role": "organizer",
  "tenantName": "Innovate Labs"
}
\`\`\`
**Token Usage:** Save this JWT token for second tenant testing

#### **1.3 Login as Admin (No Token Required)**
\`\`\`
POST http://localhost:3000/api/users/login
Content-Type: application/json

{
  "email": "admin@techcorp.com",
  "password": "password123"
}
\`\`\`
**Token Usage:** Save the JWT token from response - use as `ADMIN_TOKEN`

---

### **Step 2: Event Management**

#### **2.1 Create Event (Requires: ADMIN or ORGANIZER Token)**
\`\`\`
POST http://localhost:3000/api/events
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "title": "Tech Conference 2024",
  "description": "Annual technology conference with industry leaders",
  "date": "2024-12-15T10:00:00Z",
  "capacity": 5
}
\`\`\`
**Token Required:** Admin or Organizer token from their tenant

#### **2.2 Create Second Event (Requires: ADMIN or ORGANIZER Token)**
\`\`\`
POST http://localhost:3000/api/events
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "title": "AI Workshop",
  "description": "Hands-on AI development workshop",
  "date": "2024-12-20T14:00:00Z",
  "capacity": 2
}
\`\`\`
**Token Required:** Same admin/organizer token

#### **2.3 Get All Events (Requires: Any Valid Token)**
\`\`\`
GET http://localhost:3000/api/events
Authorization: Bearer ADMIN_TOKEN
\`\`\`
**Token Required:** Any authenticated user token (shows only their tenant's events)

---

### **Step 3: User Management (Create Attendees)**

#### **3.1 Create Attendee 1 (Requires: ADMIN Token)**
\`\`\`
POST http://localhost:3000/api/register
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "name": "Alice Attendee",
  "email": "alice@techcorp.com",
  "password": "password123",
  "role": "attendee",
  "tenantId": 11
}
\`\`\`
**Token Required:** Admin token (only admins can create attendees)
**Note:** Use the tenant ID from your admin login response

#### **3.2 Create Attendee 2 (Requires: ADMIN Token)**
\`\`\`
POST http://localhost:3000/api/register
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "name": "Bob Attendee", 
  "email": "bob@techcorp.com",
  "password": "password123",
  "role": "attendee",
  "tenantId": 11
}
\`\`\`
**Token Required:** Same admin token

#### **3.3 Create Attendee 3 (Requires: ADMIN Token)**
\`\`\`
POST http://localhost:3000/api/register
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "name": "Charlie Attendee",
  "email": "charlie@techcorp.com", 
  "password": "password123",
  "role": "attendee",
  "tenantId": 11
}
\`\`\`
**Token Required:** Same admin token

---

### **Step 4: Booking Flow Testing**

#### **4.1 Login as Attendee 1 (No Token Required)**
\`\`\`
POST http://localhost:3000/api/users/login
Content-Type: application/json

{
  "email": "alice@techcorp.com",
  "password": "password123"
}
\`\`\`
**Token Usage:** Save as `ALICE_TOKEN`

#### **4.2 Book Event (Requires: ATTENDEE Token)**
\`\`\`
POST http://localhost:3000/api/book-event
Authorization: Bearer ALICE_TOKEN
Content-Type: application/json

{
  "eventId": "EVENT_ID_FROM_STEP_2.2"
}
\`\`\`
**Token Required:** Alice's attendee token
**Expected:** Status "confirmed" (capacity: 2, confirmed: 1)

#### **4.3 Login as Attendee 2 & Book Same Event**
\`\`\`
POST http://localhost:3000/api/users/login
Content-Type: application/json

{
  "email": "bob@techcorp.com",
  "password": "password123"
}
\`\`\`
**Token Usage:** Save as `BOB_TOKEN`

\`\`\`
POST http://localhost:3000/api/book-event
Authorization: Bearer BOB_TOKEN
Content-Type: application/json

{
  "eventId": "EVENT_ID_FROM_STEP_2.2"
}
\`\`\`
**Token Required:** Bob's attendee token
**Expected:** Status "confirmed" (capacity: 2, confirmed: 2)

#### **4.4 Login as Attendee 3 & Book Same Event (Should be Waitlisted)**
\`\`\`
POST http://localhost:3000/api/users/login
Content-Type: application/json

{
  "email": "charlie@techcorp.com",
  "password": "password123"
}
\`\`\`
**Token Usage:** Save as `CHARLIE_TOKEN`

\`\`\`
POST http://localhost:3000/api/book-event
Authorization: Bearer CHARLIE_TOKEN
Content-Type: application/json

{
  "eventId": "EVENT_ID_FROM_STEP_2.2"
}
\`\`\`
**Token Required:** Charlie's attendee token
**Expected:** Status "waitlisted" (event is full)

---

### **Step 5: Waitlist Promotion Testing**

#### **5.1 Cancel Bob's Booking (Requires: BOB's Token)**
\`\`\`
POST http://localhost:3000/api/cancel-booking
Authorization: Bearer BOB_TOKEN
Content-Type: application/json

{
  "bookingId": "BOB_BOOKING_ID"
}
\`\`\`
**Token Required:** Bob's token (users can only cancel their own bookings)
**Expected:** Charlie automatically promoted from waitlist to confirmed

---

### **Step 6: Notification System Testing**

#### **6.1 Check Alice's Notifications (Requires: ALICE's Token)**
\`\`\`
GET http://localhost:3000/api/my-notifications
Authorization: Bearer ALICE_TOKEN
\`\`\`
**Token Required:** Alice's token (users can only see their own notifications)
**Expected:** Notification about booking confirmation

#### **6.2 Check Charlie's Notifications (Requires: CHARLIE's Token)**
\`\`\`
GET http://localhost:3000/api/my-notifications
Authorization: Bearer CHARLIE_TOKEN
\`\`\`
**Token Required:** Charlie's token
**Expected:** Two notifications - waitlisted, then promoted

#### **6.3 Mark Notification as Read (Requires: User's Own Token)**
\`\`\`
POST http://localhost:3000/api/notifications/NOTIFICATION_ID/read
Authorization: Bearer CHARLIE_TOKEN
\`\`\`
**Token Required:** Token of the user who owns the notification

---

### **Step 7: Dashboard Analytics Testing**

#### **7.1 Get Organizer Dashboard (Requires: ADMIN or ORGANIZER Token)**
\`\`\`
GET http://localhost:3000/api/dashboard
Authorization: Bearer ADMIN_TOKEN
\`\`\`
**Token Required:** Admin or Organizer token
**Expected:** 
- Upcoming events with booking counts
- Circular progress data
- Summary analytics
- Recent activity feed

---

### **Step 8: Multi-Tenancy Testing**

#### **8.1 Login as Second Tenant Organizer (No Token Required)**
\`\`\`
POST http://localhost:3000/api/users/login
Content-Type: application/json

{
  "email": "organizer@innovate.com",
  "password": "password123"
}
\`\`\`
**Token Usage:** Save as `SECOND_TENANT_TOKEN`

#### **8.2 Try to Access First Tenant's Events (Should Show Only Own Tenant)**
\`\`\`
GET http://localhost:3000/api/events
Authorization: Bearer SECOND_TENANT_TOKEN
\`\`\`
**Token Required:** Second tenant's token
**Expected:** Only see events from "Innovate Labs" tenant, not "TechCorp Solutions"

#### **8.3 Try to Book First Tenant's Event (Should Fail)**
\`\`\`
POST http://localhost:3000/api/book-event
Authorization: Bearer SECOND_TENANT_TOKEN
Content-Type: application/json

{
  "eventId": "FIRST_TENANT_EVENT_ID"
}