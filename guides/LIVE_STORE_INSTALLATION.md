# Live Store Installation Guide

## Prerequisites

- Shopify Plus plan (required for checkout extensions)
- Install link generated from Partners Dashboard
- Store owner access or admin permissions

---

## Installation Steps

### 1. Install the App

1. Click the **install link** provided by developer
2. Review the permissions requested:
   - Read orders
   - Write customers
   - Write discounts
   - Write price rules
   - Write products
   - Write cart transforms
3. Click **"Install app"**
4. Wait for redirect to app dashboard

---

### 2. Enable Checkout Extension (to show the checkout plaus box in the checkout page)

1. Go to **Settings → Checkout**
2. Select the checkout profile you want to use (e.g., "Default" or custom checkout)
3. Scroll down to **Order-summery** section
4. Click add block and select the checkout-plus 
5. Click **Save**
6. publish the checkout


---

### 3. Create Protection Product

create a hidden product
1. Go to: Products → Add product
2. Fill in:
* Title: Order Protection
* Description: Protection for your order with cashback rewards
* Price: $00.00
* SKU: (leave empty)
* Uncheck: "Charge tax on this product"
* Product type: Service
* Vendor: Store
* Tags: order-protection, hidden
* Catagory should be uncatagorized
* Add varient 
   put title as "Title" and this as "Protect against loss, theft and damage (ONW76)"
   make this a physical product by clicking the Varient
3. IMPORTANT: Make sure Status is set to Active (not Draft)
4. IMPORTANT: Make sure it's published to "Online Store" sales channel
* Scroll to "Inventory" section
* Check: ☑ "Continue selling when out of stock"

1. Click Save

---

### 4. Register Order Webhook (Manual Step Required)

**Important:** This webhook cannot be registered automatically due to protected customer data requirements.

1. Go to **Settings → Notifications → Webhooks**
2. Click **"Create webhook"**
3. Configure:
   - **Event:** `Order creation`
   - **Format:** `JSON`
   - **URL:** `https://app.interactivecheckout.com/webhooks/orders/create`
   - **API version:** `2026-04` (latest)
4. Click **Save**

---


## 5. enable cart transform (dynamic product price). (will be good if we automate this process)

Open Postman
Click New → HTTP Request
Set method to POST
      https://meonutrition.myshopify.com/admin/api/2024-10/graphql.json

Go to Headers tab, add these 2 headers:
Content-Type	application/json
X-Shopify-Access-Token	YOUR_ACCESS_TOKEN_HERE

how to get the "YOUR_ACCESS_TOKEN_HERE"
      1. open app dashboard so that app update access token in database e.g this link 
         https://admin.shopify.com/store/meonutrition/apps/checkout-plus-20
      2. then go to the database and copy the accessToken for the correct store

   Step 1: Get Function ID
      Go to Body tab
      Select raw and JSON
      Paste this: 
            {
               "query": "query { shopifyFunctions(first: 10) { nodes { id apiType title } } }"
            }
      
      Click Send
      Copy the id where apiType is "CART_TRANSFORM"

   Step 2: Create Cart Transform
      Keep everything same, just change the Body to:
            {
               "query": "mutation { cartTransformCreate(functionId: \"PASTE_FUNCTION_ID_HERE\") { cartTransform { id functionId } userErrors { field message } } }"
            }
      
      Replace PASTE_FUNCTION_ID_HERE with the ID from Step 1
      Click Send
      Copy the transform id from the response (looks like gid://shopify/CartTransform/123456)

   Step 3: Activate Cart Transform
      Change the Body to:
         {
            "query": "mutation { cartTransformActivate(cartTransformId: \"PASTE_TRANSFORM_ID_HERE\") { cartTransform { id status } userErrors { field message } } }"
         }
      Replace PASTE_TRANSFORM_ID_HERE with the transform ID from Step 2
      Click Send
      Look for "status": "ACTIVE" ✅


## 6. Inserting the checout+ UI in the cart
      got to online store > themes
      customize the theme
      select cart page from the top dropdown
      in the leftsidebar > select the App embeds option > enable the Checkout+ (auto inject).
      save > then test on visiting live store and add product to cart and check in cart
      if not present then the store target elements are changed
      get elemets targets and ask AI agent do do job accordingly

## Testing Checklist

Before going live, test the complete flow:

### Test Order Steps

1. **Add product to cart** on storefront
2. **Go to checkout**
3. **Verify checkbox appears:**
   ```
   ☐ Checkout+ for $X.XX
       Protect your package, earn $Y.YY cashback, and more.
   ```
4. **Check the box** (fee should be added)
5. **Complete order** using test payment:
   - Enable test mode: Settings → Payments → Test mode
   - Test card: `1` (card number), any CVV/expiry
6. **Verify backend processing:**
   - Check webhook delivery (Settings → Notifications → Webhooks)
   - Check Vercel logs for webhook processing
7. **Verify results:**
   - Discount code created (Admin → Discounts)
   - Customer tagged as "VIP-CASHBACK" (Admin → Customers)
   - Email sent via Klaviyo
8. **Test discount code:**
   - Create new order
   - Apply discount code at checkout
   - Verify it works

### What to Check

- [ ] Checkout extension visible
- [ ] Protection fee calculates correctly (4% of cart)
- [ ] Order completes successfully
- [ ] Webhook fires (check Settings → Notifications → Webhooks)
- [ ] Discount code created in admin
- [ ] Customer tagged properly
- [ ] Klaviyo email received
- [ ] Discount code works on next order

---

## Multiple Checkout Profiles

If your store has multiple checkout profiles:

1. You can enable the extension on **specific profiles** only
2. Go to Settings → Checkout → Select profile
3. Configure extensions per profile
4. Test on each profile separately

---

## Configuration (Optional)

### Adjust Cashback/Insurance Percentages

Edit configuration if needed (requires developer):

**File:** `app/config.js`
```javascript
CASHBACK_PERCENT: 5,     // Customer earns 5%
INSURANCE_PERCENT: 4,    // Customer pays 4%
```

Changes require redeployment to Vercel.

---

## Troubleshooting

### Extension Not Showing in Checkout

**Possible causes:**
- Extension not enabled (Settings → Checkout → Extensions)
- Wrong checkout profile selected
- Not on Shopify Plus plan
- Browser cache (test in incognito mode)

### Webhook Not Firing

**Check:**
1. Webhook registered correctly (Settings → Notifications → Webhooks)
2. URL is correct: `https://app.interactivecheckout.com/webhooks/orders/create`
3. Format is JSON
4. Vercel backend is running (check Vercel dashboard)

### No Discount Code Created

**Check:**
1. Webhook logs in Vercel
2. Customer checked the box during checkout
3. API scopes include `write_discounts` and `write_price_rules`
4. Database connection working

### Email Not Sent

**Check:**
1. Klaviyo API key is valid
2. Sender email verified in Klaviyo
3. Klaviyo Flow is active and triggered by `cashback` metric
4. Check Klaviyo logs for metric events

---

## Updating the App

### When Developer Pushes Updates

**Backend/web app changes:**
- Auto-deploy from Vercel
- No action needed from your side

**Extension changes (UI/checkout):**
- Updates roll out automatically within 5 minutes
- All stores get the update
- No reinstallation needed

### Rolling Back (If Issues Occur)

Contact developer to rollback using:
```bash
shopify app release --version <previous-version>
```

---

## Support Contacts

**For technical issues:**
- Check Vercel logs
- Review webhook delivery in Shopify admin
- Contact developer with:
  - Error message
  - Time of occurrence
  - Order number (if applicable)

---

## Important Notes

- **Data privacy:** This app handles customer order data - ensure compliance with privacy policies
- **Testing:** Always test on staging/test mode before processing real orders
- **Monitoring:** Regularly check webhook delivery and email sending rates
- **Updates:** App updates are automatic - monitor first orders after updates

---

## Summary

**Quick checklist for installation:**

1. ✅ Click install link → Install app
2. ✅ Enable checkout extension (Settings → Checkout)
3. ✅ Create protection product (via app dashboard)
4. ✅ Register orders webhook manually (Settings → Notifications)
5. ✅ Test complete flow with test order
6. ✅ Monitor first few real orders

**Time to install:** ~10-15 minutes  
**Testing time:** ~15-20 minutes

---

**Ready to install?** Follow steps 1-5 above, then run through the testing checklist!
