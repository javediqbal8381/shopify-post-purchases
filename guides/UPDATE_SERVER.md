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

That's all you need! Just push your code to GitHub, SSH into your server, and run `./deploy.sh` to update.
