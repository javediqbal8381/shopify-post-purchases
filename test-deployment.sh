#!/bin/bash

# Script to test if app works on Vercel

echo "🔍 Testing Vercel deployment..."
echo ""

# Test 1: Check if Vercel is accessible
echo "1️⃣ Testing Vercel URL..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://app.interactivecheckout.com)
if [ "$STATUS" = "404" ] || [ "$STATUS" = "200" ]; then
  echo "✅ Vercel is live (Status: $STATUS - This is normal for root path)"
else
  echo "❌ Vercel not accessible (Status: $STATUS)"
fi

echo ""
echo "2️⃣ Next steps:"
echo "   → Go to: https://partners.shopify.com"
echo "   → Login with the email you used for Shopify CLI"
echo "   → Find your app: post-purchases-flow"
echo "   → Update Configuration → URLs:"
echo "      App URL: http://app.interactivecheckout.com"
echo "      Redirect URL: http://app.interactivecheckout.com/api/auth"
echo "   → Click Save"
echo ""
echo "3️⃣ Then reinstall the app on your dev store"
echo ""

