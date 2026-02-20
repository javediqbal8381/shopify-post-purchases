# Known Issues & Fixes

A log of issues encountered during development and their root causes/solutions.
Reference this file to quickly diagnose recurring problems.

---

## Format

Each entry follows this structure:

### [Short Title]
- **Date:** YYYY-MM-DD
- **Symptom:** What happened / error message
- **Root Cause:** Why it happened
- **Fix:** How it was resolved
- **Notes:** Any extra context (optional)

---

## Issues

### Checkout+ Products Not Auto-Fulfilled
- **Date:** 2026-02-20
- **Symptom:** Products added via Checkout+ (post-purchase offers) were not being auto-fulfilled after order creation.
- **Root Cause:** The app was missing `read_merchant_managed_fulfillment_orders` and `write_merchant_managed_fulfillment_orders` scopes in `shopify.app.checkout-plus.toml`. Without these, the app couldn't read or trigger fulfillment orders for merchant-managed items.
- **Fix:** Added both scopes to the `scopes` string in the TOML config, then restarted `npm run dev` so the CLI re-authenticated and granted the new permissions on the dev store.
- **Notes:** After adding new scopes to the TOML, you must restart the dev server. The CLI will prompt to update permissions automatically. Always verify scopes via **Shopify Admin > Settings > Apps and sales channels > [App] > API access** or by calling `GET /admin/oauth/access_scopes.json`.
