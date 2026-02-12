# Docker Deployment Guide

Simple guide to deploy this Shopify app on a server using Docker.

## Prerequisites

- Ubuntu server (Digital Ocean, AWS, etc.)
- SSH access to your server
- Domain name or IP address

## Initial Setup (First Time Only)

### 1. SSH into Your Server

```bash
ssh root@YOUR_SERVER_IP
```

### 2. Install Docker

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### 3. Clone Your Repository

```bash
cd /var/www
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

### 4. Create Environment File

Create a `.env` file with your credentials:

```bash
nano .env
```

Add your configuration (replace with your actual values):

```env
DATABASE_URL=your_database_url
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_APP_URL=http://YOUR_SERVER_IP
SCOPES=read_orders,write_orders,read_fulfillments,read_assigned_fulfillment_orders,write_assigned_fulfillment_orders,write_cart_transforms,write_customers,write_discounts,write_price_rules,write_products
NODE_ENV=production
RESEND_FROM_EMAIL=your_email@domain.com
RESEND_API_KEY=your_resend_api_key
```

**Important:** Do NOT use quotes around values.

Save with `Ctrl+X`, then `Y`, then `Enter`.

### 5. Configure Firewall

```bash
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable
```

### 6. Initial Deployment

```bash
# Make deploy script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

### 7. Verify It's Running

```bash
# Check container is running
sudo docker ps

# Check logs
sudo docker logs post-purchases-flow

# Test the URL
curl http://localhost
```

## Updating Server After Code Changes

Whenever you push new code to GitHub, update your server:

### On Your Server:

```bash
./deploy.sh
```

That's it! The script automatically:
- Pulls latest code
- Rebuilds Docker image
- Restarts the container
- Shows you the logs

## Useful Commands

### View Logs

```bash
# Live logs (press Ctrl+C to exit)
sudo docker logs -f post-purchases-flow

# Last 100 lines
sudo docker logs --tail 100 post-purchases-flow
```

### Restart Container

```bash
sudo docker restart post-purchases-flow
```

### Stop Container

```bash
sudo docker stop post-purchases-flow
```

### Start Container

```bash
sudo docker start post-purchases-flow
```

### Check Container Status

```bash
sudo docker ps
```

### Access Container Shell

```bash
sudo docker exec -it post-purchases-flow sh
```

## Troubleshooting

### Container Won't Start

Check the logs:

```bash
sudo docker logs post-purchases-flow
```

Common issues:
- Wrong environment variables in `.env`
- Database connection failed
- Port 80 already in use

### Port Already in Use

Find what's using port 80:

```bash
sudo lsof -i :80
```

### Environment Variables Not Working

Make sure there are NO quotes in your `.env` file:

**Wrong:**
```env
SHOPIFY_API_KEY="abc123"
```

**Correct:**
```env
SHOPIFY_API_KEY=abc123
```

### Reset Everything

If something is broken, you can reset:

```bash
# Stop and remove container
sudo docker stop post-purchases-flow
sudo docker rm post-purchases-flow

# Remove old image
sudo docker rmi post-purchases-flow

# Run deploy script again
./deploy.sh
```

## Production Checklist

For production deployment:

- ✅ Use HTTPS (requires domain + SSL certificate)
- ✅ Set `NODE_ENV=production` in `.env`
- ✅ Secure `.env` file: `chmod 600 .env`
- ✅ Never commit `.env` to git
- ✅ Set up monitoring/alerts
- ✅ Configure automatic backups
- ✅ Update Shopify app URLs to use HTTPS

## SSL Setup (Production Required)

Shopify requires HTTPS for production apps. To set up SSL:

1. Get a domain name
2. Point domain to your server IP
3. Install Certbot: `sudo apt install certbot python3-certbot-nginx -y`
4. Get certificate: `sudo certbot --nginx -d yourdomain.com`
5. Update `.env` with `SHOPIFY_APP_URL=https://yourdomain.com`
6. Run `./deploy.sh` to restart with new URL

## Need Help?

Common commands:
- Deploy updates: `./deploy.sh`
- View logs: `sudo docker logs -f post-purchases-flow`
- Restart: `sudo docker restart post-purchases-flow`
- Check status: `sudo docker ps`
