# Cashback & Insurance Upsell System

Complete implementation of Cosara/Onwards-style checkout upsell with cashback rewards.

## 🎯 What It Does

1. **Checkout Upsell**: Shows insurance + cashback offer in checkout
2. **Insurance Fee**: Customer pays 4% fee added to cart
3. **Cashback Reward**: Customer earns 5% of order total
4. **Discount Code**: Generated and emailed after purchase
5. **VIP Tagging**: Customers tagged for premium return handling via Loop

## 📦 What's Included

### Frontend
- **Checkout Extension** (`extensions/checkout-protection/`) - Displays upsell in checkout
  - Shows cashback amount dynamically (5% of cart total)
  - Shows insurance fee (4% of cart total)
  - Checkbox toggle to opt-in
  - Adds hidden protection product to cart

### Backend
- **Config** (`app/config.js`) - Centralized settings
- **Webhook Handler** (`app/routes/webhooks.orders.create.jsx`)
  - Detects protection purchase
  - Generates discount codes
  - Tags customers as VIP
  - Sends email with code
- **Admin Dashboard** (`app/routes/app._index.jsx`)
  - Setup interface
  - Configuration display
  - Product creation

## 🚀 Setup Instructions

### Step 1: Install & Deploy

```bash
npm install
npm run dev
```

### Step 2: Create Protection Product

1. Open your app in Shopify admin
2. Click "Create Protection Product" button
3. Copy the **Variant ID** shown

### Step 3: Enable Checkout Extension

1. Go to Shopify Admin → Settings → Checkout
2. Scroll to Checkout extensions section
3. Find "checkout-protection" and enable it
4. Position it in the Order summary section (recommended)
5. Click Save

### Step 4: Configure Email Sending (Optional)

Email sending is configured with Klaviyo. To customize:

1. Get a Klaviyo private API key from https://www.klaviyo.com
2. Set environment variable: `KLAVIYO_API_KEY=your_key_here`
3. For custom domain: `KLAVIYO_FROM_EMAIL=noreply@yourdomain.com`
4. Optional: update the template in `app/routes/webhooks.orders.create.jsx`

### Step 5: Test

1. Add products to cart
2. Go to checkout (not cart)
3. Check the "Checkout+ for $X.XX" box
4. Complete checkout with test card (use card number: 1)
5. Check email for cashback code
6. Verify discount code in Shopify Admin → Discounts
7. Verify customer tagged as VIP in Shopify Admin → Customers

## ⚙️ Configuration

Edit `app/config.js` to customize:

```javascript
export const CASHBACK_CONFIG = {
  CASHBACK_PERCENT: 5,       // % customer earns
  INSURANCE_PERCENT: 4,      // % customer pays
  CODE_EXPIRY_DAYS: 365,     // Code validity
  VIP_TAG: 'VIP-CASHBACK',   // Customer tag
  PROTECTION_PRODUCT_HANDLE: 'order-protection',
  DISCOUNT_CODE_PREFIX: 'CASHBACK',
};
```

## 📧 Email Configuration

Email sending is implemented using Klaviyo Transactional API:

1. Sign up at https://www.klaviyo.com
2. Create a private API key
3. Set `KLAVIYO_API_KEY` in your environment
4. Set `KLAVIYO_FROM_EMAIL` to a verified sender

## 🔧 Required Scopes

The following scopes are already configured in `shopify.app.toml`:

- `write_products` - Create protection product
- `read_orders` - Read order data
- `write_price_rules` - Create discount codes
- `write_discounts` - Apply discounts
- `write_customers` - Tag VIP customers

## 📊 How It Works

```
Customer sees upsell → Checks box → Protection added to cart →
Order created → Webhook triggered → Discount code generated →
Customer tagged VIP → Email sent with code
```

## 💡 Example

**Cart Total:** $100
**Insurance Fee:** $4 (4%)
**Cashback Earned:** $5 (5%)

Customer pays: $104
Customer receives: $5 discount code for next order
**Customer net:** $1 profit ($5 reward - $4 fee)
**Store net:** $4 revenue from insurance fee

## 🔗 Loop Returns Integration

The VIP tag is used with Loop Returns app:
1. Customers with "VIP-CASHBACK" tag get premium service
2. Configure Loop to recognize this tag
3. VIP customers get easier returns/exchanges
4. Configure in Loop dashboard (not code)

This integration is ready - just set up in Loop's admin panel.

## 📝 Notes

- This is an **upsell**, not real insurance
- Cashback is **post-purchase** (not instant)
- Code is **one-time use**
- Works **store-wide**

## 🐛 Troubleshooting

**Checkbox not showing in checkout?**
- Go to Settings → Checkout → Checkout extensions
- Enable "checkout-protection"
- Save and test

**No email received?**
- Check terminal logs for webhook processing
- Verify Klaviyo API key is correct
- Check spam folder
- Verify sender email is allowed in Klaviyo

**Discount code not working?**
- Check Shopify Admin → Discounts for the code
- Verify customer ID matches (for logged-in customers)
- Check code expiry date (365 days default)

**Webhook not firing?**
- Webhook is registered automatically after deployment
- Check terminal logs when placing orders
- Ensure app is installed on the store

## 🎨 Customization

### Change Percentages
Edit `app/config.js`:
- `CASHBACK_PERCENT` - Customer reward %
- `INSURANCE_PERCENT` - Fee charged %

### Change UI Text
Edit `extensions/checkout-protection/src/Checkout.jsx`:
- Checkbox label and description
- Update line 223-227

### Change Email Template
Edit `app/routes/webhooks.orders.create.jsx`:
- HTML template starts at line 212
- Customize colors, text, branding

---

Built for: Tech Emulsion
Based on: Cosara/Onwards checkout upsell system

