# 🎯 START HERE - Cashback Protection System

## What You Just Built

You created your own **Onwards/Cosara replacement** to save 75% commission fees!

---

## 💰 The Business Model Explained

### For Customers:
- Order: **$100**
- Check "Checkout+" box
- Pay: **$104** (4% insurance = $4)
- Receive after delivery: **$5 discount code** (5% cashback)
- **Customer profits: $1** ($5 - $4 = $1 net gain)

### For You (Store Owner):
- Customer pays you extra **$4** insurance fee
- You send **$5** discount code (they spend on your store later)
- **You earn: $4 per order** as pure profit
- Customer is happy + tagged as VIP
- Lower cashback = more profit for you

### Why Build This vs. Using Onwards:
- **Onwards:** Takes 75% → You get $1, they get $3
- **Your System:** You keep 100% → You get $4, they get $0

**On 50 orders/day × $100 average = $200/day extra revenue = $6,000/month!**

---

## 🚀 Quick Setup (3 Steps)

### Step 1: Start Dev Server (If Not Running)
```bash
npm run dev
```

### Step 2: Create Protection Product
1. Open app dashboard (URL shown in terminal)
2. Click **"Create Protection Product"** button
3. Copy the Variant ID shown

### Step 3: Enable Checkout Extension
1. Go to: **Shopify Admin → Settings → Checkout**
2. Find: **Checkout extensions** section
3. Enable: **"checkout-protection"**
4. Choose position: **Order summary** (recommended)
5. Click: **Save**

---

## ✅ Testing

1. Go to your store: `checkout-plus-dev-store-2.myshopify.com`
2. Add product to cart
3. Go to **Checkout** (not cart!)
4. You'll see:
   ```
   ☐ Checkout+ for $X.XX
       Protect your package, earn $Y.YY cashback, and more.
   ```
5. **Check the box** → Fee added to order (4% of cart total)
6. Complete checkout with test card (card number: 1, any CVV/expiry)
7. Check email → Cashback code received
8. Check admin → Discount code created (Admin → Discounts)
9. Check customer → Tagged as "VIP-CASHBACK" (Admin → Customers)

---

## 📂 What Each File Does

### Extensions (Frontend)
- `extensions/checkout-protection/` - Shows checkbox in checkout

### Backend (Logic)
- `app/config.js` - Settings (change % here)
- `app/routes/webhooks.orders.create.jsx` - Creates discount codes
- `app/routes/app._index.jsx` - Admin dashboard

### Documentation
- `SIMPLE_GUIDE.md` - Detailed setup guide
- `CASHBACK_SETUP.md` - Technical documentation

---

## ⚙️ Configuration

Want to change percentages?

Edit: `app/config.js`
```javascript
CASHBACK_PERCENT: 5,     // Customer earns 5%
INSURANCE_PERCENT: 4,    // Customer pays 4%
```

---

## 🎨 How It Looks

**In Checkout:**
```
☐ Checkout+ for $2.35
  Protect your package, earn $5.50 cashback, and more.
```

**When Checked:**
```
☑ Checkout+ for $2.35
  Protect your package, earn $5.50 cashback, and more.

Order Summary:
- Product: $55.00
- Order Protection: $2.35
━━━━━━━━━━━━━━━━━━
Total: $57.35
```

---

## 🔧 Advanced: Email Setup

To automatically EMAIL cashback codes:

1. Get a Klaviyo private API key from [Klaviyo](https://www.klaviyo.com)
2. Set `KLAVIYO_API_KEY` in your environment
3. Set `KLAVIYO_FROM_EMAIL` to a verified sender
4. Edit the template in `app/routes/webhooks.orders.create.jsx` if needed

---

## 📊 What Happens Behind the Scenes

```
Customer checks box in checkout
          ↓
Protection product added ($4 fee)
          ↓
Cart attributes saved (metadata)
          ↓
Customer completes order
          ↓
Webhook fires (orders/create)
          ↓
Reads: "protection enabled = true"
          ↓
Generates discount code ($10 value)
          ↓
Tags customer as "VIP-CASHBACK"
          ↓
Emails code to customer
          ↓
Customer uses code on next order
```

---

## ❓ FAQs

### Q: Why do we need to create a product?
**A:** Shopify needs a product to add the insurance fee to checkout. It's hidden from customers.

### Q: Can I change the percentages?
**A:** Yes! Edit `app/config.js`

### Q: Does this work on live store?
**A:** Yes! Deploy with `npm run deploy`

### Q: What about Loop Returns integration?
**A:** Customers with "VIP-CASHBACK" tag get premium service in Loop.

### Q: Can customers see the protection product?
**A:** No, it's hidden. They only see "Order Protection $X.XX" in checkout.

---

## 🎯 Next Steps

1. ✅ Dev server running
2. ⬜ Create protection product
3. ⬜ Enable checkout extension
4. ⬜ Test on dev store
5. ⬜ Configure email (optional)
6. ⬜ Deploy to production
7. ⬜ Launch & profit!

---

## 💡 Pro Tips

- Start with 10% cashback / 4% fee (current settings)
- Monitor conversion rate (how many check the box)
- A/B test different percentages
- Highlight the "earn cashback" in marketing
- Use Loop Returns for VIP customers

---

## 🆘 Need Help?

Check terminal for errors or test in dev store first!

**Common Issues:**
- Extension not showing? Enable in Settings → Checkout
- No discount code? Check webhook logs
- Email not sent? Configure email service

---

**Ready to test?** Go to Settings → Checkout and enable the extension! 🚀

