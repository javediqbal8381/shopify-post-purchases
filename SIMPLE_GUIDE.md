# Simple Guide: Cashback & Protection System

## 🤔 What Is This?

You're replicating **Onwards/Cosara** functionality for your Meonutrition.com store.

### The Business Model (Simple)

**Customer's View:**
- Cart total: $100
- They check "Checkout+" box
- They pay: $104 (extra $4 insurance fee)
- After delivery: They get $5 discount code
- **Customer wins**: Paid $4, got $5 back = $1 profit

**Your View (Store Owner):**
- Customer paid you $4 extra
- You send them $5 code (they spend it later on your store)
- **You win**: Made $4 revenue from insurance fee
- Customer is happy and comes back
- Better profit margin with 5% vs 10% cashback

**Why not use Onwards?**
- Onwards charges 75% commission
- If customer pays $4, Onwards keeps $3, you get $1
- Building yourself = you keep all $4

---

## 🎯 What You Built

### 1. **Checkout Extension**
Shows checkbox in checkout:
```
☐ Checkout+ for $4.00
  Protect your package, earn $10.00 cashback, and more.
```

### 2. **Automatic Calculations**
- Insurance fee: 4% of cart total
- Cashback: 5% of cart total
- Updates in real-time

### 3. **Backend System**
When order completes:
1. Detects if protection was enabled
2. Creates discount code for cashback amount
3. Tags customer as VIP
4. Emails code to customer

### 4. **Loop Integration**
VIP tagged customers get:
- Easier returns
- Better service
- Premium treatment

---

## 📋 Setup Steps (What You Need to Do)

### Step 1: Create Protection Product

**Why?** Shopify needs a product to add the $4 fee to checkout.

1. Open your app dashboard
2. Click "Create Protection Product"
3. Done! (It's hidden from customers)

### Step 2: Enable Checkout Extension

1. Go to: **Shopify Admin → Settings → Checkout**
2. Scroll to: **Checkout extensions**
3. Find: "checkout-protection"
4. Click: **Turn ON**
5. Position it where you want (try "Order summary")
6. Click: **Save**

### Step 3: Test It

1. Add product to cart on your store
2. Go to checkout
3. You'll see the checkbox!
4. Check it → $4 added to total
5. Complete order
6. Check: Discount code created in admin
7. Check: Customer has "VIP-CASHBACK" tag

### Step 4: Setup Email (Optional)

The system creates discount codes automatically, but to EMAIL them:

1. Add your Klaviyo private API key to `KLAVIYO_API_KEY`
2. Set `KLAVIYO_FROM_EMAIL` to your verified sender
3. Edit the template in `app/routes/webhooks.orders.create.jsx` if needed

---

## ⚙️ How It Works (Technical)

```
Customer checks box
   ↓
Cart attribute saved: "_protection_enabled = true"
   ↓
Protection product added to cart (hidden, $4 fee)
   ↓
Customer completes checkout (pays $4 extra)
   ↓
Webhook fires on order creation
   ↓
Reads cart attributes
   ↓
Generates discount code worth $10
   ↓
Tags customer as "VIP-CASHBACK"
   ↓
Sends email with code (if configured)
   ↓
Customer uses code on next order
```

---

## 🎨 Customization

Want to change the percentages?

Edit: `app/config.js`

```javascript
export const CASHBACK_CONFIG = {
  CASHBACK_PERCENT: 5,     // Current: 5% cashback
  INSURANCE_PERCENT: 4,    // Current: 4% fee
};
```

---

## 💡 Real Example

**Meonutrition.com scenario:**

Customer orders: **$50 protein powder**

**Without protection:**
- Pays: $50
- Gets: Nothing extra

**With protection (checked box):**
- Pays: $52 ($50 + $2 insurance)
- Gets: $5 discount code after delivery
- Net benefit: $3 profit for customer
- **You earned: $2 from insurance fee**

**On a $1000/day store:**
- 50% of customers check the box
- Average order: $100
- Insurance collected per day: $100 × 50 orders × 4% = **$200/day revenue**
- **$6,000/month extra revenue** for you

---

## 🔧 Troubleshooting

**Checkbox not showing?**
- Go to Settings → Checkout → Enable the extension

**No email sent?**
- Configure email service in webhook handler
- Or manually check Discounts in admin

**Customer not tagged?**
- Check webhook logs in terminal
- Ensure webhook is registered

---

## 📊 Summary

✅ Simple checkbox in checkout  
✅ Customer pays small fee ($4)  
✅ Customer gets reward ($5)  
✅ You keep the insurance fee  
✅ Customer tagged as VIP  
✅ Works with Loop returns  
✅ No Onwards commission (75% saved!)  

**Result:** Happy customers + Extra revenue for you 🎉

---

## 🚀 Next Steps

1. ✅ App is built
2. ⏳ Create protection product (in app dashboard)
3. ⏳ Enable checkout extension (Settings → Checkout)
4. ⏳ Test with real order
5. ⏳ Configure email sending
6. ⏳ Launch!

---

Need help? Check the terminal for errors or test on checkout-plus-dev-store-2.myshopify.com first!

