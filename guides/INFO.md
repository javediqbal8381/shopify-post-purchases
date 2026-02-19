# Checkout+ App — Complete Technical Overview

## Simple Explanation

Checkout+ is a Shopify app that adds **order protection** at checkout. When a customer opts in, they pay a small 4% insurance fee, and in return they earn a **5% cashback** discount code sent to their email after 30 days.

**In short**: Customer pays 4% extra at checkout → gets 5% cashback code after 30 days → comes back and shops again.

The app has 4 main parts:

1. **Shopify Extensions** — UI that appears in the cart and checkout (what the customer sees)
2. **Backend Server** — Handles webhooks, processes cashbacks, and serves the dashboard
3. **Cron Job** — Runs periodically to send cashback emails when 30 days have passed
4. **Merchant Dashboard** — Standalone web portal where merchants view analytics and orders

---

## How It Works (End to End)

```
Customer adds items to cart
        ↓
Cart page shows "Checkout+" toggle (theme extension)
        ↓
Customer enables protection → protection product added to cart
        ↓
Cart Transformer function → prices protection at 4% of cart subtotal
        ↓
Customer completes checkout → Shopify fires orders/create webhook
        ↓
Webhook handler:
  1. Auto-fulfills the protection product (it's digital, no shipping needed)
  2. Creates a PendingCashback record in database (scheduled for 30 days later)
        ↓
Cron job runs every day (or every minute in testing mode)
        ↓
Finds cashbacks where 30 days have passed
        ↓
For each ready cashback:
  1. Creates a Shopify discount code (5% of order total)
  2. Tags customer as VIP
  3. Sends branded email with the discount code via Resend API
        ↓
Customer receives email → uses code on next purchase → repeat
```

---

## Project Structure

```
post-purchases-flow/
├── app/                          # Backend application code
│   ├── config.js                 # Cashback/insurance percentages, delays
│   ├── cron.server.js            # Scheduled job to process cashbacks
│   ├── db.server.js              # Prisma database client
│   ├── shopify.server.js         # Shopify API configuration
│   ├── routes/                   # All API routes, webhooks, pages
│   ├── dashboard/                # Dashboard auth, components
│   └── email-templates/          # HTML email templates
├── extensions/                   # Shopify checkout/cart extensions
│   ├── cart-checkout-plus/       # Theme extension (cart page UI)
│   ├── cart-transformer/         # Function extension (dynamic pricing)
│   ├── checkout-protection/      # Checkout UI extension (toggle)
│   └── checkout-line-remove/     # Checkout UI extension (remove button)
├── prisma/                       # Database schema and migrations
├── guides/                       # Documentation
├── Dockerfile                    # Production Docker build
├── deploy.sh                     # Server deployment script
└── shopify.app.checkout-plus.toml  # Shopify app configuration
```

---

## Part 1: Shopify Extensions

These are the pieces that run inside Shopify's cart and checkout pages — the customer-facing UI.

### 1.1 Cart Theme Extension (`extensions/cart-checkout-plus/`)

**What it does**: Injects a "Checkout+" UI into the merchant's cart page/drawer.

**How it works**:
- `checkout_plus_embed.liquid` — Auto-detects the cart drawer or cart page on any Shopify theme
- Renders a checkbox/button showing the insurance fee (4%) and cashback amount (5%)
- When the customer clicks it, adds the hidden "order-protection" product to the cart
- Hides the protection product from the visible cart so customers only see the Checkout+ UI
- Dynamically updates prices when cart total changes
- Auto-removes protection if the cart becomes empty

**Type**: Theme App Extension (Liquid + JavaScript)

### 1.2 Cart Transformer (`extensions/cart-transformer/`)

**What it does**: Dynamically sets the price of the protection product based on the cart subtotal.

**How it works**:
- Runs as a Shopify Function on `cart.transform.run` target
- Finds the "order-protection" product in the cart
- Calculates 4% of the cart subtotal (excluding the protection product itself)
- Updates the line item price and renames it to "Checkout+"
- This ensures the protection always costs exactly 4% regardless of the product's listed price

**Type**: Shopify Function Extension (JavaScript)

### 1.3 Checkout Protection Toggle (`extensions/checkout-protection/`)

**What it does**: Shows a protection toggle inside the Shopify checkout page.

**How it works**:
- Renders after the cart line list in checkout (`purchase.checkout.cart-line-list.render-after`)
- Shows a checkbox with insurance fee and cashback amounts
- Adds/removes the protection product from checkout
- Sets order attributes (`_protection_enabled`, `_cashback_amount`, `_insurance_fee`) that the backend reads later

**Type**: Checkout UI Extension (React)

### 1.4 Cart Line Remove Button (`extensions/checkout-line-remove/`)

**What it does**: Adds a "remove" button specifically for the protection product in checkout.

**How it works**:
- Renders after each cart line item (`purchase.checkout.cart-line-item.render-after`)
- Detects if the current line item is the protection product
- Shows a remove button that removes it from cart and clears order attributes

**Type**: Checkout UI Extension (React)

---

## Part 2: Backend Server

The backend is a React Router (Remix-based) app that handles Shopify authentication, webhooks, API endpoints, and serves the merchant dashboard.

**Tech Stack**: Node.js, React Router v7, Prisma ORM, PostgreSQL (Neon), Vite

### 2.1 Shopify Configuration (`app/shopify.server.js`)

- Configures the Shopify app using `@shopify/shopify-app-react-router`
- API Version: October 2025
- Session storage: Prisma-based (stores OAuth tokens in the database)
- Distribution: App Store
- Exports `authenticate`, `login`, `registerWebhooks`, `sessionStorage`

### 2.2 App Configuration (`app/config.js`)

Central configuration for the cashback system:

| Setting | Value | Description |
|---------|-------|-------------|
| `CASHBACK_PERCENT` | 5% | What the customer earns back |
| `INSURANCE_PERCENT` | 4% | What the customer pays at checkout |
| `PROTECTION_PRODUCT_HANDLE` | `order-protection` | Hidden Shopify product handle |
| `DISCOUNT_CODE_PREFIX` | `CASHBACK` | Prefix for generated codes |
| `VIP_TAG` | `VIP-CASHBACK` | Tag added to customers |
| `CODE_EXPIRY_DAYS` | 365 | Discount code validity |
| `CASHBACK_DELAY_MINUTES` | 43200 (30 days) | Wait time before sending email |

### 2.3 Webhook Routes

#### `webhooks.orders.create.jsx` — Order Created

Triggered when a new order is placed. Does two things:

1. **Auto-fulfills the protection product** — The protection product is digital (no shipping needed). After a 5-second delay (to let Shopify create fulfillment orders), it finds the protection line item and marks it as fulfilled silently (no customer notification).

2. **Schedules cashback** — Creates a `PendingCashback` record in the database with `emailScheduledFor` set to 30 days from now. Stores the order ID, customer email, cashback amount, and shop domain.

#### `webhooks.orders.fulfilled.jsx` — Order Fulfilled

Triggered when the merchant fulfills the physical items. This is a secondary handler that can also process fulfillment-related logic for protection orders.

#### `webhooks.app.uninstalled.jsx` — App Uninstalled

Cleans up sessions from the database when a merchant uninstalls the app.

#### `webhooks.app.scopes_update.jsx` — Scopes Updated

Updates stored session scopes when app permissions change.

### 2.4 API Routes

#### `api.process-cashback.jsx` — Cashback Processor

The core cashback engine. Called by the cron job. For each pending cashback where the scheduled time has passed:

1. Finds the shop's session and access token
2. Looks up the customer in Shopify by email
3. Creates a Shopify Price Rule (percentage discount)
4. Generates a unique discount code (e.g., `CASHBACK-ABC123`)
5. Tags the customer as `VIP-CASHBACK`
6. Sends a branded email via Resend API with the discount code
7. Marks the cashback as sent in the database

Includes retry logic (max 3 retries) and error handling per cashback.

#### `api.create-product.jsx` — Product Creator

Creates the hidden "Order Protection" product in the merchant's Shopify store. This is the product that gets added to the cart when a customer opts into protection.

#### `api.auth.logout.jsx` — Logout

Destroys the dashboard user session.

#### `api.switch-store.jsx` — Store Switcher

For multi-store merchants, switches the active store in their dashboard session.

### 2.5 Cron Job (`app/cron.server.js`)

- Uses `node-cron` to run on a schedule
- **Testing mode**: Every 1 minute
- **Production mode**: Daily at 10:00 AM
- Calls the `/api/process-cashback` endpoint
- HMR-safe (prevents duplicate jobs during development)
- Configurable via `CASHBACK_ENDPOINT` env var

### 2.6 Email System

- **Provider**: Resend API
- **Template**: `app/email-templates/meonutrition-cashback.html`
- **Placeholders**: `{{CUSTOMER_NAME}}`, `{{CASHBACK_CODE}}`, `{{CASHBACK_AMOUNT}}`, `{{STORE_URL}}`, `{{EXPIRY_DATE}}`, `{{ORDER_NUMBER}}`
- **Utility**: `app/email-templates/utils.js` loads template and replaces placeholders

---

## Part 3: Merchant Dashboard

A standalone web portal (not embedded in Shopify) where merchants log in with email/password to view their analytics.

### Routes

| Route | File | Description |
|-------|------|-------------|
| `/signin` | `signin.jsx` | Login page |
| `/signup` | `signup.jsx` | Registration page |
| `/dashboard` | `dashboard._index.jsx` | Main dashboard with charts |
| `/dashboard/orders` | `dashboard.orders.jsx` | Orders list with filters |
| `/dashboard/settings` | `dashboard.settings.jsx` | Profile and password management |

### Dashboard Home (`/dashboard`)

Two tabs:

**Protect Tab**:
- KPI cards: total insured orders, protection revenue, attach rate
- Bar chart: attach rate over time
- Donut charts: insured vs uninsured, revenue breakdown
- Top protected products table

**CashBack Tab**:
- KPI cards: total cashback sent, pending cashbacks, redemption rate
- Area chart: cashback amount over time
- Recent cashback orders table

**Features**:
- Date range filter with presets (7d, 30d, 90d, custom)
- Data scoped to the logged-in merchant's shop
- Charts powered by Recharts
- Responsive layout

### Orders Page (`/dashboard/orders`)

- Fetches orders from Shopify Admin API via GraphQL
- Search by order number, customer name, email
- Filter by date range, financial status, insured/uninsured
- CSV export
- Pagination with cursor-based navigation
- Shows protection status and cashback info per order

### Authentication

- Session-based auth using cookies
- Password hashing with bcrypt
- Multi-store support (one user can manage multiple Shopify stores)
- Store switcher in the dashboard sidebar

---

## Part 4: Database

**Provider**: PostgreSQL hosted on Neon  
**ORM**: Prisma

### Models

#### Session
Stores Shopify OAuth sessions. Used by the Shopify app library to authenticate API calls.

| Field | Purpose |
|-------|---------|
| `shop` | Shopify store domain |
| `accessToken` | API access token |
| `scope` | Granted API permissions |
| `isOnline` | Online vs offline session |

#### PendingCashback
Tracks every cashback from creation to email delivery.

| Field | Purpose |
|-------|---------|
| `orderId` | Shopify order ID (unique) |
| `customerEmail` | Where to send the code |
| `cashbackAmount` | Dollar amount of cashback |
| `emailScheduledFor` | When to send (order date + 30 days) |
| `emailSent` | Whether email has been sent |
| `discountCode` | Generated Shopify discount code |
| `retryCount` | Number of failed attempts |

#### DashboardUser
Standalone merchant accounts for the dashboard portal.

| Field | Purpose |
|-------|---------|
| `email` | Login email |
| `passwordHash` | Bcrypt hashed password |
| `shopDomains` | Array of connected Shopify stores |
| `activeShopDomain` | Currently selected store |

---

## Part 5: Configuration Files

### `shopify.app.checkout-plus.toml`
- App client ID and name
- Application URL (where the app is hosted)
- Webhook subscriptions: `app/uninstalled`, `app/scopes_update`, `fulfillments/create`
- API scopes required by the app
- Auth redirect URLs

### `shopify.web.toml`
- Defines this as a React Router app with frontend + backend roles
- Pre-dev command: `npx prisma generate`
- Dev command: runs Prisma migrations then starts the dev server

### `Dockerfile`
- Node.js 20 Alpine base image
- Installs production dependencies only
- Builds the app, then runs `prisma generate` + `react-router-serve`

### `deploy.sh`
- Pulls latest code from GitHub
- Rebuilds Docker image
- Stops and removes old container
- Starts new container with env file

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SHOPIFY_API_KEY` | Shopify app API key |
| `SHOPIFY_API_SECRET` | Shopify app API secret |
| `SHOPIFY_APP_URL` | Public URL of the deployed app |
| `SCOPES` | Shopify API permissions |
| `NODE_ENV` | `production` or `development` |
| `RESEND_API_KEY` | Resend email service API key |
| `RESEND_FROM_EMAIL` | Sender email address |
| `CASHBACK_DELAY_MINUTES` | Minutes before sending cashback (default: 43200 = 30 days) |
| `CASHBACK_ENDPOINT` | URL for cron to call (defaults to localhost) |

---

## API Scopes Required

```
read_orders, write_orders, read_fulfillments,
read_assigned_fulfillment_orders, write_assigned_fulfillment_orders,
write_cart_transforms, write_customers,
write_discounts, write_price_rules, write_products
```

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Backend Framework | React Router v7 (Remix-based) |
| Runtime | Node.js 20 |
| Database | PostgreSQL (Neon) |
| ORM | Prisma |
| Email | Resend API |
| Cron | node-cron |
| Build Tool | Vite |
| Deployment | Docker on Digital Ocean |
| Shopify Integration | @shopify/shopify-app-react-router |
| Dashboard Charts | Recharts |
| Extensions | Liquid, Shopify Functions (JS), Checkout UI (React) |

---

## Key Files Quick Reference

| What | File |
|------|------|
| App config (percentages, delays) | `app/config.js` |
| Shopify setup | `app/shopify.server.js` |
| Database client | `app/db.server.js` |
| Cron scheduler | `app/cron.server.js` |
| Order webhook | `app/routes/webhooks.orders.create.jsx` |
| Fulfillment webhook | `app/routes/webhooks.orders.fulfilled.jsx` |
| Cashback processor | `app/routes/api.process-cashback.jsx` |
| Dashboard home | `app/routes/dashboard._index.jsx` |
| Orders page | `app/routes/dashboard.orders.jsx` |
| Cart UI (theme) | `extensions/cart-checkout-plus/blocks/` |
| Cart transformer | `extensions/cart-transformer/src/cart_transform_run.js` |
| Checkout toggle | `extensions/checkout-protection/src/Checkout.jsx` |
| Remove button | `extensions/checkout-line-remove/src/CartLineRemove.jsx` |
| Email template | `app/email-templates/meonutrition-cashback.html` |
| Database schema | `prisma/schema.prisma` |
| Docker build | `Dockerfile` |
| Deploy script | `deploy.sh` |
