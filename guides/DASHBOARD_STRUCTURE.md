# Dashboard Structure Guide

This document explains how the standalone merchant dashboard is organized within the existing Shopify app codebase.

## Overview

The app serves two separate interfaces from the **same codebase and deployment**:

| Interface | URL | Auth | Purpose |
|---|---|---|---|
| Shopify Admin Panel | `/app/*` | Shopify OAuth (automatic) | Embedded admin UI inside Shopify |
| Merchant Dashboard | `/dashboard/*` | Email + password (JWT cookie) | Standalone web portal for merchants |

Both interfaces read from the **same database** (Neon PostgreSQL via Prisma).

---

## Folder Structure

```
app/
├── dashboard/                          # All dashboard-specific code (isolated)
│   ├── auth/
│   │   └── session.server.js           # JWT, password hashing, cookie helpers, auth middleware
│   └── components/
│       └── AuthLayout.jsx              # Shared styles for signin/signup pages
│
├── routes/
│   ├── signin.jsx                      # /signin — login page
│   ├── signup.jsx                      # /signup — registration page
│   ├── dashboard.jsx                   # /dashboard — layout (sidebar, topbar, auth protection)
│   ├── dashboard._index.jsx            # /dashboard — home page (stats, recent cashbacks)
│   ├── api.auth.logout.jsx             # POST /api/auth/logout — clears session cookie
│   │
│   ├── app.jsx                         # Shopify embedded admin layout (existing)
│   ├── app._index.jsx                  # Shopify admin page (existing)
│   ├── webhooks.orders.create.jsx      # Order webhook handler (existing)
│   └── ...                             # Other existing routes
│
├── db.server.js                        # Prisma client (shared by everything)
└── config.js                           # Cashback config (shared by everything)
```

---

## How Auth Works

### Flow

1. User visits `/` → redirected to `/signin` (or `/dashboard` if already logged in)
2. User signs up at `/signup` → account created in `DashboardUser` table → JWT cookie set → redirected to `/dashboard`
3. User signs in at `/signin` → password verified → JWT cookie set → redirected to `/dashboard`
4. All `/dashboard/*` routes call `requireDashboardAuth(request)` → verifies JWT cookie → returns `{ userId, email, shopDomain }`
5. If cookie is missing/invalid → redirected to `/signin`
6. Logout via POST to `/api/auth/logout` → cookie cleared → redirected to `/signin`

### Key Files

- `app/dashboard/auth/session.server.js` — All auth logic lives here:
  - `hashPassword(password)` — bcrypt hash for registration
  - `verifyPassword(password, hash)` — bcrypt compare for login
  - `createToken(user)` — creates a JWT with userId, email, shopDomain
  - `verifyToken(token)` — decodes and verifies a JWT
  - `createSessionCookie(token)` — builds Set-Cookie header for login
  - `destroySessionCookie()` — builds Set-Cookie header for logout
  - `getDashboardUser(request)` — extracts user from cookie (returns null if not logged in)
  - `requireDashboardAuth(request)` — same as above but redirects to /signin if not logged in

### Environment Variables

Add this to your `.env`:

```
DASHBOARD_JWT_SECRET=your-random-secret-here
```

Generate a good secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## Database

The `DashboardUser` model (in `prisma/schema.prisma`):

```prisma
model DashboardUser {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String
  shopDomain    String
  passwordHash  String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([shopDomain])
}
```

Each user is linked to a Shopify store via `shopDomain`. All dashboard queries filter by this field to scope data to the correct store.

---

## How to Add a New Dashboard Page

1. Create a new route file: `app/routes/dashboard.my-page.jsx`
2. In the loader, call `requireDashboardAuth(request)` to get the logged-in user
3. Query data using `user.shopDomain` to scope to their store
4. The page automatically gets the sidebar and topbar from `dashboard.jsx` layout

Example:

```jsx
// app/routes/dashboard.my-page.jsx
import { useLoaderData } from "react-router";
import { requireDashboardAuth } from "../dashboard/auth/session.server";

export const loader = async ({ request }) => {
  const user = requireDashboardAuth(request);
  // Fetch data scoped to user.shopDomain ...
  return Response.json({ data });
};

export default function MyPage() {
  const { data } = useLoaderData();
  return <div>...</div>;
}
```

Then add a nav link in `dashboard.jsx` sidebar.

---

## Extracting to a Separate App (Later)

If you ever need to move the dashboard to a standalone MERN/Next.js app:

1. **Backend**: Copy `app/dashboard/auth/` → works as-is (just JS functions)
2. **Frontend**: Copy `app/dashboard/components/` + route components → standard React
3. **Database**: Same Prisma schema, point `DATABASE_URL` to the same Neon database
4. **Routes**: Convert `dashboard.*.jsx` loaders/actions to Express/Next.js API routes

The `dashboard/` folder is intentionally self-contained to make this migration straightforward.
