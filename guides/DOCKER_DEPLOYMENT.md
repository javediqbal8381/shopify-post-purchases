# Docker Deployment Guide for Digital Ocean

This guide walks you through deploying the post-purchases-flow Shopify app on a Digital Ocean server using Docker.

## Prerequisites

- Digital Ocean droplet (Ubuntu recommended)
- SSH access to your server
- Code cloned to the server
- Basic familiarity with terminal commands

## Quick Start

If you just want to deploy quickly, follow these steps:

### 1. SSH into Your Server

```bash
ssh root@YOUR_SERVER_IP
```

### 2. Navigate to Your Project

```bash
cd /path/to/your/post-purchases-flow
```

### 3. Create Environment File

Create a `.env` file with your configuration:

```bash
nano .env
```

Paste this content (update `YOUR_SERVER_IP` with your actual IP):

```env
DATABASE_URL=postgresql://neondb_owner:npg_65lHEuzjyfKN@ep-round-pine-abryeq45-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
SHOPIFY_API_KEY=e051efa27d6d36cd1d66129ed595f4b9
SHOPIFY_API_SECRET=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
SHOPIFY_APP_URL=http://YOUR_SERVER_IP
SCOPES=read_orders,write_orders,read_fulfillments,read_assigned_fulfillment_orders,write_assigned_fulfillment_orders,write_cart_transforms,write_customers,write_discounts,write_price_rules,write_products
NODE_ENV=production
RESEND_FROM_EMAIL=noreply@plus.meonutrition.com
RESEND_API_KEY=re_aKFpev2u_KWBN386FVxvFd6GKqtLe7kpY
```

**Important**: Do NOT use quotes around values in the `.env` file.

Save with `Ctrl+X`, then `Y`, then `Enter`.

### 4. Install Docker

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### 5. Build Docker Image

```bash
sudo docker build -t post-purchases-flow .
```

### 6. Run the Container

```bash
sudo docker run -d \
  --name post-purchases-flow \
  --restart unless-stopped \
  -p 80:3000 \
  --env-file .env \
  post-purchases-flow
```

### 7. Verify Deployment

```bash
# Check logs
sudo docker logs -f post-purchases-flow

# Test the endpoint
curl http://localhost:80
```

Press `Ctrl+C` to exit logs (container keeps running).

### 8. Configure Firewall

```bash
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable
```

### 9. Update Shopify Configuration

On your **local machine**, update `shopify.app.checkout-plus.toml`:

```toml
application_url = "http://YOUR_SERVER_IP"

[auth]
redirect_urls = [ "http://YOUR_SERVER_IP/api/auth" ]
```

Then push to Shopify:

```bash
shopify app config push
```

## Detailed Deployment Steps

### Understanding the Dockerfile

The project includes a production-ready Dockerfile:

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./

RUN npm ci --omit=dev && npm cache clean --force

COPY . .

RUN npm run build

CMD ["npm", "run", "docker-start"]
```

This:
- Uses Node.js 20 Alpine (lightweight)
- Installs only production dependencies
- Builds the React Router app
- Runs Prisma migrations
- Starts the server on port 3000

### Environment Variables Explained

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (Neon database) |
| `SHOPIFY_API_KEY` | From Shopify Partners Dashboard |
| `SHOPIFY_API_SECRET` | From Shopify Partners Dashboard |
| `SHOPIFY_APP_URL` | Your server's public URL |
| `SCOPES` | Shopify API permissions required |
| `NODE_ENV` | Set to `production` for deployment |
| `RESEND_FROM_EMAIL` | Email sender address |
| `RESEND_API_KEY` | Resend API key for sending emails |

### Port Mapping

The Docker run command uses `-p 80:3000`:
- `80` = Host port (what users connect to)
- `3000` = Container port (what the app runs on)

This allows accessing the app via `http://YOUR_IP` without specifying a port.

## Docker Management Commands

### View Running Containers

```bash
sudo docker ps
```

### View All Containers (including stopped)

```bash
sudo docker ps -a
```

### View Logs

```bash
# Live logs (follow mode)
sudo docker logs -f post-purchases-flow

# Last 100 lines
sudo docker logs --tail 100 post-purchases-flow

# Logs from last 10 minutes
sudo docker logs --since 10m post-purchases-flow
```

### Stop Container

```bash
sudo docker stop post-purchases-flow
```

### Start Container

```bash
sudo docker start post-purchases-flow
```

### Restart Container

```bash
sudo docker restart post-purchases-flow
```

### Remove Container

```bash
sudo docker stop post-purchases-flow
sudo docker rm post-purchases-flow
```

### Update and Redeploy

When you update code on the server:

```bash
# Pull latest code
git pull

# Rebuild image
sudo docker build -t post-purchases-flow .

# Stop and remove old container
sudo docker stop post-purchases-flow
sudo docker rm post-purchases-flow

# Run new container
sudo docker run -d \
  --name post-purchases-flow \
  --restart unless-stopped \
  -p 80:3000 \
  --env-file .env \
  post-purchases-flow
```

### Execute Commands Inside Container

```bash
# Run Prisma migrations
sudo docker exec -it post-purchases-flow npx prisma migrate deploy

# Access container shell
sudo docker exec -it post-purchases-flow sh

# View environment variables
sudo docker exec post-purchases-flow env
```

## Advanced Setup (Optional)

### Using Nginx as Reverse Proxy

For production, you might want to use Nginx for better performance and SSL support:

#### Install Nginx

```bash
sudo apt update
sudo apt install nginx -y
```

#### Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/post-purchases-flow
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

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

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/post-purchases-flow /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**Note**: If using Nginx, change Docker port mapping to `-p 3000:3000` instead of `-p 80:3000`.

### SSL Setup with Let's Encrypt

**Required for production Shopify apps**

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate (requires domain name)
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
```

## Troubleshooting

### Container Won't Start

Check logs for errors:

```bash
sudo docker logs post-purchases-flow
```

Common issues:
- Invalid environment variables (check `.env` file)
- Port 80 already in use
- Database connection issues

### Port Already in Use

If port 80 is already taken:

```bash
# Find what's using port 80
sudo lsof -i :80

# Use a different port
sudo docker run -d \
  --name post-purchases-flow \
  --restart unless-stopped \
  -p 8080:3000 \
  --env-file .env \
  post-purchases-flow
```

### Environment Variables Not Loading

Common mistake: Adding quotes around values in `.env` file.

**Wrong**:
```env
SHOPIFY_APP_URL="http://138.68.11.117"
```

**Correct**:
```env
SHOPIFY_APP_URL=http://138.68.11.117
```

If you change `.env`, you must recreate the container:

```bash
sudo docker stop post-purchases-flow
sudo docker rm post-purchases-flow
sudo docker run -d --name post-purchases-flow --restart unless-stopped -p 80:3000 --env-file .env post-purchases-flow
```

### Database Connection Issues

Verify database URL is correct:

```bash
# Test from container
sudo docker exec -it post-purchases-flow npx prisma db pull
```

### Container Exits Immediately

View logs to see why:

```bash
sudo docker logs post-purchases-flow
```

Check if build completed successfully:

```bash
sudo docker build -t post-purchases-flow .
```

### High Memory Usage

Monitor container resources:

```bash
sudo docker stats post-purchases-flow
```

## Production Considerations

### ⚠️ Important: HTTP vs HTTPS

This guide uses HTTP for simplicity. **Shopify requires HTTPS for production apps**.

To use HTTPS, you need:
1. A domain name (not just an IP address)
2. SSL certificate (free with Let's Encrypt)
3. Nginx configured with SSL

### Backup Strategy

Regular backups are important:

```bash
# Backup environment file
cp .env .env.backup

# Export Docker image
sudo docker save post-purchases-flow > post-purchases-flow.tar
```

### Monitoring

Consider setting up monitoring:
- **Docker stats**: `sudo docker stats`
- **Logs**: Regularly check logs for errors
- **Uptime monitoring**: Use services like UptimeRobot

### Security

- Keep Docker updated: `sudo apt update && sudo apt upgrade`
- Use firewall: Only allow necessary ports
- Secure `.env` file: `chmod 600 .env`
- Don't commit `.env` to git
- Use secrets management for production

## Automated Deployment Script

Create a deploy script for easier updates:

```bash
nano deploy.sh
```

```bash
#!/bin/bash

echo "🚀 Deploying post-purchases-flow..."

# Pull latest code
echo "📥 Pulling latest code..."
git pull

# Rebuild image
echo "🔨 Building Docker image..."
sudo docker build -t post-purchases-flow .

# Stop old container
echo "🛑 Stopping old container..."
sudo docker stop post-purchases-flow 2>/dev/null || true
sudo docker rm post-purchases-flow 2>/dev/null || true

# Run new container
echo "▶️  Starting new container..."
sudo docker run -d \
  --name post-purchases-flow \
  --restart unless-stopped \
  -p 80:3000 \
  --env-file .env \
  post-purchases-flow

# Show logs
echo "📋 Showing logs..."
sleep 3
sudo docker logs --tail 50 post-purchases-flow

echo "✅ Deployment complete!"
```

Make it executable:

```bash
chmod +x deploy.sh
```

Run it:

```bash
./deploy.sh
```

## What's Running

After successful deployment, your app runs:

- ✅ React Router server on port 3000 (mapped to 80)
- ✅ Shopify API webhooks listening
- ✅ Cron jobs for cashback processing (every 1 minute in test mode)
- ✅ Auto-restart on server reboot
- ✅ Connected to Neon PostgreSQL database

## Next Steps

1. Test the app by accessing `http://YOUR_SERVER_IP`
2. Install the app on your development store
3. Test order creation and fulfillment
4. Monitor logs for any issues
5. Consider setting up SSL for production use

## Support

If you encounter issues:
1. Check Docker logs: `sudo docker logs post-purchases-flow`
2. Verify environment variables: `sudo docker exec post-purchases-flow env`
3. Test database connection
4. Check firewall settings
5. Review this guide's troubleshooting section

---

**Remember**: For production use with real stores, you must set up HTTPS with a domain name and SSL certificate.
