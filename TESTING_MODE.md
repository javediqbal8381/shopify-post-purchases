# Testing Configuration - TEMPORARY

## Current Settings (FOR TESTING ONLY)

### ⚠️ ACTIVE TEST MODE ⚠️

**Email Delay:** 2 minutes (instead of 30 days)
**Cron Schedule:** Every 1 minute (instead of daily at 10 AM)

---

## Test Flow

1. Place order → Webhook saves to DB
2. Wait 2 minutes
3. Cron runs (checks every minute)
4. Email sent with discount code

---

## How to Test

### Step 1: Run database migration
```bash
npx prisma db push
```

### Step 2: Deploy to Vercel
```bash
git add .
git commit -m "Add delayed cashback (test mode: 2 min)"
git push
```

### Step 3: Place a test order
- Add product to cart
- Enable Checkout+ protection  
- Complete checkout (card: 1)

### Step 4: Wait and watch
- Wait 2-3 minutes
- Check email for cashback code
- Check Vercel logs: `/api/process-cashback`

### Step 5: Verify in database
```sql
SELECT * FROM "PendingCashback" 
WHERE "emailSent" = true 
ORDER BY "emailSentAt" DESC 
LIMIT 1;
```

---

## ⚠️ REVERT TO PRODUCTION SETTINGS

### After testing, change these 2 files:

#### 1. `app/routes/webhooks.orders.create.jsx` (line ~101)

**Change FROM (testing):**
```javascript
emailScheduledFor.setMinutes(emailScheduledFor.getMinutes() + 2); // TODO: Change to 30 days
```

**Change TO (production):**
```javascript
emailScheduledFor.setDate(emailScheduledFor.getDate() + 30);
```

#### 2. `vercel.json`

**Change FROM (testing):**
```json
{
  "crons": [{
    "path": "/api/process-cashback",
    "schedule": "* * * * *"
  }]
}
```

**Change TO (production):**
```json
{
  "crons": [{
    "path": "/api/process-cashback",
    "schedule": "0 10 * * *"
  }]
}
```

Then deploy:
```bash
git add .
git commit -m "Revert to production: 30 days + daily cron"
git push
```

---

## Notes

- **Cron runs every minute** in test mode - you'll see it in Vercel logs frequently
- **2 minute delay** is perfect for testing the full flow
- **Don't forget to revert** before going live with real customers!

---

## Quick Revert Command

When ready to go to production, I can instantly revert both settings back to 30 days.
