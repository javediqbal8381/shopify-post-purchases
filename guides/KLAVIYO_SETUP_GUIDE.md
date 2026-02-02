# Klaviyo Setup Guide for Cashback Email Flow

**For: Client (Non-Technical)**  
**Purpose:** Set up automated cashback emails in Klaviyo

---

## Prerequisites

- Active Klaviyo account (paid plan recommended)
- Admin access to Klaviyo dashboard
- Verified sender domain or email address

---

## Part 1: Initial Setup (One-Time)

### Step 1: Get Your Private API Key

1. Log into your **Klaviyo account**
2. Go to **Settings** (bottom left) → **API Keys**
3. Click **Create Private API Key**
4. Name it: `Shopify Cashback Integration`
5. Set permissions: **Full Access** (or at minimum: `Metrics:Write`, `Profiles:Write`)
6. Click **Create**
7. **Copy the key** (starts with `pk_` or similar) and share it with your developer
8. ⚠️ **Important:** Keep this key secure and never share it publicly

---

### Step 2: Verify Your Sender Email

**Why?** Klaviyo requires verified senders to prevent spam.

1. Go to **Settings** → **Email** → **Sending**
2. Under **Sender Addresses**, click **Add Sender Address**
3. Enter your email (e.g., `noreply@meonutrition.com` or `support@yourstore.com`)
4. Click **Send Verification Email**
5. Check your inbox and **click the verification link**
6. Once verified, share this email address with your developer

**Alternative:** Verify your entire domain for more flexibility.

---

## Part 2: Create the Cashback Email Flow

### Step 3: Create a New Flow

1. Go to **Flows** (left sidebar)
2. Click **Create Flow** (top right)
3. Choose **Create From Scratch**
4. Name it: `Cashback Email` or `Post-Purchase Cashback Reward`
5. Click **Create Flow**

---

### Step 4: Set Up the Trigger

1. Click **Add Trigger**
2. Select **Metric**
3. In the search box, type: `cashback`
4. Select the **cashback** metric (created by your app)
5. Click **Done**

**Note:** If you don't see the `cashback` metric, place a test order first with protection enabled.

---

### Step 5: Add the Email

1. Click the **+** button below the trigger
2. Select **Email**
3. Choose a template or start from scratch
4. Click **Edit Content**

---

### Step 6: Design the Email

#### Email Subject Line:
```
🎉 You earned {{ event.cashback_formatted }} cashback!
```

#### Email Body:

Use the drag-and-drop editor. Here's what to include:

**Header:**
```
Your Cashback is Here! 🎉
```

**Greeting:**
```
Hi {{ event.customer_first_name }},
```

**Body Text:**
```
Thank you for your order {{ event.order_number }}! As promised, here's your cashback reward:
```

**Cashback Details (use a highlight box):**
```
💰 Cashback Amount: {{ event.cashback_formatted }}
🎁 Discount Code: {{ event.discount_code }}
⏰ Expires: {{ event.expiry_date }} ({{ event.expiry_days }} days)
```

**How to Use:**
```
✅ Valid on your next purchase
✅ Works store-wide on all products
✅ One-time use only
✅ Expires in {{ event.expiry_days }} days
```

**Call to Action Button:**
- Text: `Shop Now`
- Link: `{{ event.shop_url }}`

**Footer:**
```
Thanks for being a VIP customer! Enjoy your cashback reward.
```

---

### Step 7: Configure Email Settings

1. **From Email:** Select your verified sender (from Step 2)
2. **From Name:** Your store name (e.g., "Meo Nutrition")
3. **Preview Text:** `Your {{ event.cashback_formatted }} discount code inside!`
4. Click **Save**

---

### Step 8: Flow Settings

1. **Smart Sending:** Turn **OFF** (this is transactional, not marketing)
2. **Flow Filters:** Set to **None** (send to everyone who earns cashback)
3. **Timing:** Email should send immediately (default)

---

### Step 9: Review and Activate

1. Click **Review and Turn On** (top right)
2. Review all settings
3. Click **Turn On Flow**
4. Status should change to **Live** ✅

---

## Part 3: Testing

### Step 10: Place a Test Order

1. Go to your Shopify store
2. Add a product to cart
3. Go to checkout
4. **Check the "Checkout+" or "Order Protection" box**
5. Complete the order
6. Check your email inbox (use the email from the order)

**Expected:** You should receive the cashback email within 1-2 minutes.

---

## Part 4: Troubleshooting

### Problem 1: No Email Received

**Check these in order:**

#### A. Check if the event was received
1. Go to **Metrics** (left sidebar)
2. Search for `cashback`
3. Click on it
4. Check **Recent Activity**
5. You should see your test order

**Fix if missing:** Contact your developer - the app isn't sending the event.

---

#### B. Check if the Flow triggered
1. Go to **Flows** → Open your `Cashback Email` flow
2. Click on the email box
3. Check **Analytics** or **Recent Activity**
4. Look for your email address

**Fix if missing:** 
- Make sure Flow is **Live** (green dot)
- Check Flow Filters aren't blocking the email

---

#### C. Check the profile subscription status
1. Go to **Audience** → **Profiles**
2. Search for your email address
3. Click on the profile
4. Check **Email** status

**Possible issues:**
- **Never subscribed:** Profile was never opted in
  - **Fix:** Make sure your Shopify checkout collects email consent OR make the flow transactional (see below)
- **Suppressed:** Profile unsubscribed
  - **Fix:** Re-subscribe or make the flow transactional

---

#### D. Apply for Transactional Status (Optional)

If you want to send to unsubscribed/suppressed profiles:

1. Go to your Flow
2. Click on the **Email** box
3. In the right sidebar, click **Apply for transactional status**
4. Wait for approval (up to 24 hours)
5. Once approved, emails will bypass suppression

**Note:** Transactional emails must follow strict rules (no marketing content).

---

### Problem 2: Wrong Email Content

**Check these:**

1. **Missing variables?**
   - Make sure you used `{{ event.discount_code }}` not just typed the code
   - Check spelling: `{{ event.amount }}` not `{{ event.cashback_amount }}`

2. **Wrong sender?**
   - Go to Flow → Email Settings
   - Update **From Email** to your verified sender

---

### Problem 3: Flow Not Triggering

**Check these:**

1. **Metric trigger correct?**
   - Flow → Trigger → should say "When someone `cashback`"
   - If it says something else, recreate the trigger

2. **Flow Status?**
   - Top right should show **Live** with a green dot
   - If it says **Draft** or **Manual**, click **Turn On**

---

## Part 5: Event Properties Reference

These are the variables you can use in your email:

| Variable | Description | Example |
|----------|-------------|---------|
| **Customer Info** |
| `{{ event.customer_first_name }}` | Customer first name | `John` |
| `{{ event.customer_name }}` | Customer full name | `John Doe` |
| `{{ person.first_name }}` | First name (from profile) | `John` |
| `{{ person.last_name }}` | Last name (from profile) | `Doe` |
| `{{ person.email }}` | Customer email | `customer@example.com` |
| **Discount Info** |
| `{{ event.discount_code }}` | The discount code | `CASHBACK123ABC` |
| `{{ event.cashback_formatted }}` | Formatted cashback amount | `$31.50` |
| `{{ event.amount }}` | Cashback amount (number) | `31.50` |
| `{{ event.currency }}` | Currency code | `USD` |
| `{{ event.expiry_date }}` | When code expires | `January 28, 2027` |
| `{{ event.expiry_days }}` | Days until expiry | `365` |
| **Order Info** |
| `{{ event.order_id }}` | Order number | `#1092` |
| `{{ event.order_number }}` | Order number (same) | `#1092` |
| **Store Info** |
| `{{ event.shop_domain }}` | Store domain | `yourstore.myshopify.com` |
| `{{ event.shop_url }}` | Full store URL | `https://yourstore.myshopify.com` |

**Usage Examples:**

```
Subject: 🎉 {{ event.customer_first_name }}, you earned {{ event.cashback_formatted }}!

Hi {{ event.customer_first_name }},

Your order {{ event.order_number }} earned you {{ event.cashback_formatted }} cashback!

Use code: {{ event.discount_code }}
Expires: {{ event.expiry_date }}

[Shop Now Button: {{ event.shop_url }}]
```

---

## Part 6: Advanced Settings (Optional)

### Add Expiry Reminder

You can create a second email in the flow to remind customers before the code expires:

1. In the Flow, click **+** below the first email
2. Add **Time Delay** → Set to `357 days` (8 days before expiry if code is valid for 365 days)
3. Click **+** below the delay
4. Add **Email** with subject: `⏰ Your {{ event.cashback_formatted }} code expires in 8 days!`

---

### Track Discount Usage

1. Go to **Reports** → **Custom Reports**
2. Create a report for the `cashback` metric
3. Track:
   - Number of emails sent
   - Open rate
   - Click rate
   - (Optional) Set up conversion tracking with Shopify

---

## Part 7: Common Questions

### Q: Can I customize the email design?
**A:** Yes! Use Klaviyo's drag-and-drop editor or HTML editor for full control.

### Q: How do I change the cashback percentage?
**A:** Contact your developer - this is set in the Shopify app configuration.

### Q: Can I send to customers who unsubscribed?
**A:** Yes, but you must apply for Transactional Status (see Troubleshooting section).

### Q: How long does approval take?
**A:** Transactional status approval takes up to 24 hours (usually faster).

### Q: Can I A/B test the email?
**A:** Not if it's marked transactional. For marketing flows, yes.

---

## Part 8: Maintenance

### Regular Checks

**Weekly:**
- Go to **Flows** → Check your flow analytics
- Verify emails are being sent and opened

**Monthly:**
- Review **Metrics** → `cashback` → Check trends
- Update email design if needed
- Check **Deliverability** report for any issues

---

## Need Help?

If you're stuck:

1. **Check Klaviyo's Activity Log:**
   - Go to the profile in question
   - Check **Activity Feed** for errors

2. **Contact your developer** if:
   - Events aren't appearing in Metrics
   - Wrong data in event properties
   - API connection issues

3. **Contact Klaviyo Support** if:
   - Flow isn't triggering despite events
   - Email design issues
   - Transactional approval questions

---

## Summary Checklist

- [ ] Private API key created and shared with developer
- [ ] Sender email verified
- [ ] Flow created and named
- [ ] Trigger set to `cashback` metric
- [ ] Email designed with correct variables
- [ ] From email set to verified sender
- [ ] Smart Sending turned OFF
- [ ] Flow turned ON (Live)
- [ ] Test order placed and email received ✅

---

**Last updated:** January 28, 2026  
**Version:** 1.0
