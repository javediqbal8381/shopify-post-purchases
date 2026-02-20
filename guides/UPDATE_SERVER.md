# Simple Server Update Guide

This guide shows you how to update your server after making code changes and pushing to GitHub.

## Quick Update (3 Steps)

### 1. SSH into Your Server

```bash
ssh root@YOUR_SERVER_IP
```

### 2. Go to Your Project Folder

```bash
cd ..
cd /var/www/shopify-post-purchases
```

### 3. Run the Deploy Script

```bash
./deploy.sh
```

That's it! The script automatically:
- ✅ Pulls latest code from GitHub
- ✅ Rebuilds the Docker image
- ✅ Stops the old container
- ✅ Starts the new container
- ✅ Shows you the logs

---

## What You'll See

When you run `./deploy.sh`, you'll see:

```
🚀 Deploying post-purchases-flow...
📥 Pulling latest code...
🔨 Building Docker image...
🛑 Stopping old container...
▶️  Starting new container...
📋 Showing logs...
✅ Deployment complete!
```

---

## First Time Setup

If this is your first time, you need to make the script executable:

```bash
chmod +x deploy.sh
```

Then you can run it:

```bash
./deploy.sh
```

---

## Common Commands

### Check if Server is Running

```bash
sudo docker ps
```

You should see `post-purchases-flow` in the list.

### View Live Logs

```bash
sudo docker logs -f post-purchases-flow
```

Press `Ctrl+C` to exit (server keeps running).

### Restart Server (Without Update)

```bash
sudo docker restart post-purchases-flow
```

### Stop Server

```bash
sudo docker stop post-purchases-flow
```

### Start Server

```bash
sudo docker start post-purchases-flow
```

---

## Typical Workflow

### From Your Computer (Local)

```bash
# 1. Make code changes
# 2. Test locally
# 3. Commit and push
git add .
git commit -m "your message"
git push
```

### On Your Server

```bash
# 1. SSH in
ssh root@YOUR_SERVER_IP

# 2. Go to project
cd /var/www/shopify-post-purchases

# 3. Update
./deploy.sh
```

Done! Your changes are live.

---

## Troubleshooting

### Script Not Found

Make sure you're in the project folder:

```bash
cd /var/www/shopify-post-purchases
ls deploy.sh
```

If it doesn't exist, create it:

```bash
nano deploy.sh
```

Paste the script content and save (`Ctrl+X`, `Y`, `Enter`).

Then make it executable:

```bash
chmod +x deploy.sh
```

### Permission Denied

Run with proper permissions:

```bash
chmod +x deploy.sh
./deploy.sh
```

### Server Not Starting

Check the logs:

```bash
sudo docker logs post-purchases-flow
```

Look for error messages (usually at the bottom).

### Changes Not Showing

Make sure you pushed to GitHub:

```bash
# On your local computer
git push
```

Then run deploy script again on server.

---

## Quick Reference Card

```bash
# Update server with latest code
./deploy.sh

# View logs
sudo docker logs -f post-purchases-flow

# Restart server
sudo docker restart post-purchases-flow

# Check if running
sudo docker ps

# Stop server
sudo docker stop post-purchases-flow

# Start server
sudo docker start post-purchases-flow
```

---

## First-Time Domain & SSL Setup

If you're setting up a domain and HTTPS for the first time on a fresh server, follow these steps.

### 1. Point Your Domain to the Server

Go to your domain registrar (Namecheap, GoDaddy, Cloudflare, etc.) and add an **A record**:

| Type | Name | Value |
|------|------|-------|
| A | `app` (or `@` for root domain) | `YOUR_SERVER_IP` |

Wait a few minutes for DNS to propagate. Verify with:

```bash
ping app.yourdomain.com
```

### 2. Install Nginx

```bash
sudo apt update
sudo apt install nginx -y
```

### 3. Create Nginx Config

```bash
sudo nano /etc/nginx/sites-available/post-purchases-flow
```

Paste this (replace `app.yourdomain.com` with your actual domain):

```nginx
server {
    listen 80;
    server_name app.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Save with `Ctrl+X`, then `Y`, then `Enter`.

### 4. Enable the Site

```bash
# Create symlink to enable the site
sudo ln -s /etc/nginx/sites-available/post-purchases-flow /etc/nginx/sites-enabled/

# Remove default site to avoid conflicts
sudo rm /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### 5. Install SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d app.yourdomain.com
```

Follow the prompts. Certbot will automatically configure HTTPS and redirect HTTP to HTTPS.

### 5.1 Open Firewall Ports

After SSL is set up, make sure both HTTP and HTTPS ports are open:

```bash
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow ssh
sudo ufw --force enable
sudo ufw status
```

Without port 443 open, HTTPS requests will time out with `ERR_CONNECTION_TIMED_OUT`.

**Important**: Docker must be running on port **3000** (not 80) for this to work. The `deploy.sh` script already does this. If your container is on port 80, fix it:

```bash
sudo docker stop post-purchases-flow
sudo docker rm post-purchases-flow
sudo docker run -d \
  --name post-purchases-flow \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  post-purchases-flow
```

### 6. Update .env with Your Domain

```bash
cd /var/www/shopify-post-purchases
nano .env
```

Change:
```env
SHOPIFY_APP_URL=https://app.yourdomain.com
```

Then recreate the container to pick up the new env:

```bash
sudo docker stop post-purchases-flow
sudo docker rm post-purchases-flow
sudo docker run -d \
  --name post-purchases-flow \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  post-purchases-flow
```

### 7. Update Shopify App Config

On your **local machine**, update `shopify.app.checkout-plus.toml`:

```toml
application_url = "https://app.yourdomain.com"

[auth]
redirect_urls = [ "https://app.yourdomain.com/api/auth" ]
```

Then push to Shopify:

```bash
shopify app config push
```

### How It All Connects

```
Browser → https://app.yourdomain.com (port 443)
  → Nginx (handles SSL) → proxy to localhost:3000
    → Docker container (your app)
```

---

## Nginx Commands

```bash
# Test config for errors
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# View Nginx status
sudo systemctl status nginx

# View Nginx error logs
sudo tail -50 /var/log/nginx/error.log

# Renew SSL certificate (auto-renews, but manual if needed)
sudo certbot renew
```

---

## Changing Domain

If you need to switch to a different domain:

1. Update DNS A record to point to your server IP
2. Edit Nginx config: `sudo nano /etc/nginx/sites-available/post-purchases-flow`
3. Change `server_name` to the new domain
4. Run: `sudo nginx -t && sudo systemctl restart nginx`
5. Get new SSL: `sudo certbot --nginx -d newdomain.com`
6. Update `.env` with new `SHOPIFY_APP_URL`
7. Recreate Docker container
8. Update `shopify.app.checkout-plus.toml` and run `shopify app config push`

---

That's all you need! Just push your code to GitHub, SSH into your server, and run `./deploy.sh` to update.
