# DEPLOYMENT INSTRUCTIONS

## Your Vercel URL
Once deployed, you'll get a URL like:
https://post-purchases-flow-xxxxx.vercel.app

## Update these files with your Vercel URL:

### 1. shopify.app.toml
Replace:
```
application_url = "https://example.com"

[auth]
redirect_urls = [ "https://example.com/api/auth" ]
```

With:
```
application_url = "https://YOUR-VERCEL-URL.vercel.app"

[auth]
redirect_urls = [ "https://YOUR-VERCEL-URL.vercel.app/api/auth" ]
```

### 2. Push to Shopify
```bash
shopify app config push
```

### 3. Reinstall App
- Go to Shopify Admin
- Apps → Uninstall your app
- Run: shopify app dev (or install from Partners dashboard)
- Reinstall the app

This registers webhooks with your Vercel URL!


