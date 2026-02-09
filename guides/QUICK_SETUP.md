# QUICK START: Delayed Cashback Setup

## What You Need To Do Now

### Step 1: Update Database ✅ REQUIRED
Run this command in your terminal:

```bash
npx prisma db push
```

This creates the new `PendingCashback` table in your database.

**Expected output:**
```
✔ Generated Prisma Client
✔ Database synchronized with Prisma schema
```

---

### Step 2: Deploy to Vercel ✅ REQUIRED

Push your changes to Git:

```bash
git add .
git commit -m "Add 30-day delayed cashback system"
git push
```

Vercel will automatically:
- Deploy your changes
- Detect the `vercel.json` file
- Register the cron job
- Start running it daily at 10:00 AM UTC

---

### Step 3: Verify Cron Job (2 minutes)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: `post-purchases-flow`
3. Go to **Settings** → **Cron Jobs**
4. You should see:
   - Path: `/api/process-cashback`
   - Schedule: `0 10 * * *` (10 AM UTC daily)
   - Status: **Active** ✅

---

## Testing

### Test 1: Place a Test Order

1. Go to your dev store
2. Add product to cart
3. Enable Checkout+ protection
4. Complete order (use test card: `1`)

**Expected result:**
- Check terminal logs for: `✅ Cashback scheduled for [date]`
- Database should have new record with `emailSent = false`

---

### Test 2: Verify Database Record

Query your database:

```sql
SELECT * FROM "PendingCashback" ORDER BY "createdAt" DESC LIMIT 1;
```

**Expected values:**
- `emailScheduledFor` = ~30 days from now
- `emailSent` = false
- `customerEmail` = your test email

---

### Test 3: Manually Trigger Cron (Optional)

To test the cron job without waiting 30 days:

**Method 1: Update database date**
```sql
-- Make a test record ready to send
UPDATE "PendingCashback"
SET "emailScheduledFor" = NOW()
WHERE "orderName" = '#1234'; -- Replace with your test order
```

**Method 2: Call the endpoint**
```bash
curl -X POST https://shopify-post-purchases.vercel.app/api/process-cashback
```

**Expected result:**
- Check Vercel logs for processing output
- Database record should have `emailSent = true`
- Customer should receive email with discount code

---

## What Changed

### ✅ New Files Created
- `vercel.json` - Cron job configuration
- `app/routes/api.process-cashback.jsx` - Daily cron endpoint
- `guides/DELAYED_CASHBACK.md` - Full documentation
- `guides/QUICK_SETUP.md` - This file

### ✅ Files Modified
- `prisma/schema.prisma` - Added `PendingCashback` table
- `app/routes/webhooks.orders.create.jsx` - Saves to DB instead of sending email

### ✅ How It Works Now
1. Customer purchases → Saved to database
2. Wait 30 days
3. Daily cron job runs at 10 AM UTC
4. Creates discount code + sends email
5. Marks as sent in database

---

## Important Notes

⚠️ **Old orders won't be migrated** - Only new orders (placed after deployment) will use the 30-day delay

⚠️ **Cron runs daily** - Emails will be sent the first time the cron runs AFTER the 30-day mark (typically within 24 hours of the scheduled date)

⚠️ **Free on Vercel** - Vercel includes cron jobs in their free tier (up to 1 cron job)

✅ **Automatic retries** - If an email fails to send, the cron will automatically retry the next day

---

## Monitoring

### Check Pending Cashbacks
```sql
SELECT 
  "orderName",
  "customerEmail",
  "emailScheduledFor",
  "emailSent"
FROM "PendingCashback"
WHERE "emailSent" = false
ORDER BY "emailScheduledFor" ASC;
```

### Check Sent Cashbacks (Last 10)
```sql
SELECT 
  "orderName",
  "discountCode",
  "emailSentAt"
FROM "PendingCashback"
WHERE "emailSent" = true
ORDER BY "emailSentAt" DESC
LIMIT 10;
```

### View Cron Logs
1. Vercel Dashboard → Your Project → Logs
2. Filter by: `/api/process-cashback`
3. Look for: `🕐 Cron job triggered`

---

## Need Help?

- **Full documentation:** `guides/DELAYED_CASHBACK.md`
- **Troubleshooting:** See "Troubleshooting" section in full docs
- **Vercel Cron Docs:** https://vercel.com/docs/cron-jobs

---

## Summary Checklist

- [ ] Run `npx prisma db push`
- [ ] Push to Git: `git push`
- [ ] Verify cron job in Vercel Dashboard
- [ ] Place a test order
- [ ] Check database for pending record
- [ ] (Optional) Test cron manually

**All done!** 🎉 Your cashback emails will now be sent 30 days after purchase.
