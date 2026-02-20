# Delayed Cashback System - 30 Day Email Delivery

## Overview

Cashback emails are now **sent 30 days after purchase** instead of immediately. This is implemented using:

- **Database storage** - Pending cashbacks stored in PostgreSQL
- **Vercel Cron Jobs** - Daily automated processing
- **Background processing** - Discount codes created when email is sent (not at purchase)

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  1. Customer purchases with protection                      │
│     ↓                                                        │
│  2. Order webhook saves to PendingCashback table            │
│     - emailScheduledFor = orderDate + 30 days               │
│     - emailSent = false                                     │
│     ↓                                                        │
│  3. Vercel Cron runs daily at 10:00 AM UTC                  │
│     - Triggered automatically by Vercel                     │
│     ↓                                                        │
│  4. Finds cashbacks where scheduledDate <= today            │
│     ↓                                                        │
│  5. For each pending cashback:                              │
│     - Creates Shopify discount code                         │
│     - Tags customer as VIP                                  │
│     - Sends email with code                                 │
│     - Marks as sent in database                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

New table: `PendingCashback`

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Unique identifier |
| `orderId` | String | Shopify order ID (unique) |
| `orderName` | String | Order number (e.g., #1001) |
| `customerEmail` | String | Customer email address |
| `customerName` | String | Customer name |
| `cashbackAmount` | String | Cashback amount (e.g., "5.00") |
| `shopDomain` | String | Shop domain |
| `customerId` | String? | Shopify customer ID (null for guests) |
| `orderCreatedAt` | DateTime | When order was placed |
| `emailScheduledFor` | DateTime | When to send email (order date + 30 days) |
| `emailSent` | Boolean | Whether email was sent |
| `emailSentAt` | DateTime? | When email was sent |
| `discountCode` | String? | Generated discount code |
| `errorMessage` | String? | Last error (if any) |
| `retryCount` | Int | Number of retry attempts |

---

## Files Modified/Created

### New Files

1. **`vercel.json`** - Configures Vercel Cron job
2. **`app/routes/api.process-cashback.jsx`** - Cron endpoint that processes delayed cashbacks
3. **`guides/DELAYED_CASHBACK.md`** - This documentation file

### Modified Files

1. **`prisma/schema.prisma`** - Added `PendingCashback` model
2. **`app/routes/webhooks.orders.create.jsx`** - Now saves to database instead of sending email

---

## Configuration

### Cron Schedule

Edit `vercel.json` to change when the job runs:

```json
{
  "crons": [{
    "path": "/api/process-cashback",
    "schedule": "0 10 * * *"  // 10:00 AM UTC daily
  }]
}
```

**Schedule format (cron syntax):**
- `0 10 * * *` = 10:00 AM daily (current)
- `0 0 * * *` = Midnight daily
- `0 */6 * * *` = Every 6 hours
- `0 2 * * 1` = 2 AM every Monday

### Delay Period

To change from 30 days to a different period, edit `app/routes/webhooks.orders.create.jsx`:

```javascript
// Line ~98
const emailScheduledFor = new Date(orderCreatedAt);
emailScheduledFor.setDate(emailScheduledFor.getDate() + 30); // Change 30 to desired days
```

---

## Setup Instructions

### Step 1: Update Database

Run Prisma migration to create the new table:

```bash
npx prisma db push
```

This creates the `PendingCashback` table in your PostgreSQL database.

### Step 2: Deploy to Vercel

Push your code to Git (Vercel auto-deploys):

```bash
git add .
git commit -m "Add delayed cashback system (30 days)"
git push
```

Vercel will automatically:
- Detect `vercel.json`
- Register the cron job
- Start running it daily at 10:00 AM UTC

### Step 3: Verify Cron Job

1. Go to **Vercel Dashboard** → Your Project → Settings → Cron Jobs
2. You should see: `/api/process-cashback` scheduled for `0 10 * * *`
3. Status should be "Active"

---

## Testing

### Test Order Processing

1. Place a test order with protection enabled
2. Check database to verify record created:

```sql
SELECT * FROM "PendingCashback" ORDER BY "createdAt" DESC LIMIT 5;
```

You should see:
- `emailScheduledFor` = 30 days from now
- `emailSent` = false

### Test Cron Job Manually

You can manually trigger the cron job to test it:

```bash
# Using curl
curl -X POST https://app.interactivecheckout.com/api/process-cashback

# Or visit in browser (GET request also works)
https://app.interactivecheckout.com/api/process-cashback
```

**To test with actual data:**
1. Create a test record with `emailScheduledFor` set to today or yesterday
2. Run the manual trigger
3. Check logs in Vercel Dashboard

### Check Logs

View cron job execution logs:

1. **Vercel Dashboard** → Your Project → Logs
2. Filter by: `/api/process-cashback`
3. Look for:
   - `🕐 Cron job triggered`
   - `📦 Found X cashback(s) to process`
   - `✅ Cron job completed`

---

## Monitoring

### Database Queries

**View pending cashbacks:**
```sql
SELECT 
  "orderName",
  "customerEmail", 
  "cashbackAmount",
  "emailScheduledFor",
  "emailSent"
FROM "PendingCashback" 
WHERE "emailSent" = false
ORDER BY "emailScheduledFor" ASC;
```

**View sent cashbacks:**
```sql
SELECT 
  "orderName",
  "customerEmail",
  "discountCode",
  "emailSentAt"
FROM "PendingCashback" 
WHERE "emailSent" = true
ORDER BY "emailSentAt" DESC
LIMIT 10;
```

**Check for errors:**
```sql
SELECT 
  "orderName",
  "customerEmail",
  "errorMessage",
  "retryCount"
FROM "PendingCashback" 
WHERE "errorMessage" IS NOT NULL
ORDER BY "updatedAt" DESC;
```

---

## Error Handling

### Automatic Retries

If sending a cashback fails:
- Error is logged to `errorMessage` field
- `retryCount` is incremented
- Record stays marked as `emailSent = false`
- **Next day's cron job will retry automatically**

### Manual Intervention

If a cashback repeatedly fails:

1. Check the error in database:
```sql
SELECT * FROM "PendingCashback" WHERE "orderName" = '#1234';
```

2. Fix the issue (e.g., invalid email, missing session)

3. Reset retry:
```sql
UPDATE "PendingCashback" 
SET "errorMessage" = NULL, "retryCount" = 0
WHERE "orderName" = '#1234';
```

4. Wait for next cron run or trigger manually

---

## Advanced Features

### Add Security (Optional)

Protect the cron endpoint with a secret:

1. Add to Vercel environment variables:
   - `CRON_SECRET=your-random-secret-here`

2. When calling manually, include header:
```bash
curl -X POST \
  -H "Authorization: Bearer your-random-secret-here" \
  https://app.interactivecheckout.com/api/process-cashback
```

### Change Delay for Specific Orders

You can manually adjust when a specific cashback is sent:

```sql
-- Send tomorrow instead of 30 days
UPDATE "PendingCashback"
SET "emailScheduledFor" = NOW() + INTERVAL '1 day'
WHERE "orderName" = '#1234';

-- Send immediately (will be processed in next cron run)
UPDATE "PendingCashback"
SET "emailScheduledFor" = NOW()
WHERE "orderName" = '#1234';
```

### Cancel Cashback (e.g., if order refunded)

```sql
-- Mark as sent to prevent future sending
UPDATE "PendingCashback"
SET 
  "emailSent" = true,
  "emailSentAt" = NOW(),
  "errorMessage" = 'Cancelled - order refunded'
WHERE "orderName" = '#1234';
```

---

## Troubleshooting

### Cron job not running

**Check:**
1. Vercel Dashboard → Settings → Cron Jobs shows the job
2. `vercel.json` is in project root
3. File is committed and deployed to Vercel

**Solution:**
Redeploy or manually re-sync cron jobs in Vercel settings.

---

### Emails not sending after 30 days

**Check:**
1. Database has pending records:
```sql
SELECT COUNT(*) FROM "PendingCashback" WHERE "emailSent" = false;
```

2. Cron job is running (check Vercel logs)

3. Records have correct `emailScheduledFor` date:
```sql
SELECT "emailScheduledFor" FROM "PendingCashback" WHERE "emailSent" = false;
```

**Solution:**
- If dates are wrong: Fix webhook logic
- If cron not running: Check Vercel Dashboard → Cron Jobs
- If records exist but not processing: Check for errors in logs

---

### Database connection errors

**Error:** `PrismaClient is unable to connect`

**Solution:**
1. Check `DATABASE_URL` environment variable in Vercel
2. Verify database is accessible from Vercel's IP ranges
3. Check Supabase/database service status

---

## Comparison: Before vs After

### Before (Instant Email)
```
Order → Webhook → Create Discount → Send Email → Done
```
- ✅ Simple
- ❌ No delay
- ❌ No audit trail
- ❌ Hard to modify timing

### After (Delayed Email)
```
Order → Webhook → Save to DB → Wait 30 days → 
Cron Job → Create Discount → Send Email → Mark as sent
```
- ✅ 30-day delay
- ✅ Full audit trail in database
- ✅ Easy to modify delay
- ✅ Automatic retries on failure
- ✅ Can cancel/modify before sending

---

## Future Enhancements

Possible additions:

1. **Admin Dashboard** - View/manage pending cashbacks from Shopify app
2. **Email Reminders** - "Your cashback is coming in X days"
3. **Variable Delays** - Different delays for different product types
4. **Refund Detection** - Auto-cancel cashback if order refunded
5. **Analytics** - Track cashback redemption rates

---

## Support

For issues or questions:
1. Check Vercel logs for errors
2. Query database for pending records
3. Review this documentation
4. Check `app/routes/api.process-cashback.jsx` code comments

---

**Last Updated:** Feb 9, 2026  
**Version:** 1.0
