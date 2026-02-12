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
