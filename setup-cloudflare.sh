#!/bin/bash
set -e

# SimpleAIChat Cloudflare Setup Script
# This script automates Cloudflare configuration for SimpleAIChat


# Step 1: Check Wrangler authentication
if ! wrangler whoami >/dev/null 2>&1; then
  echo "Wrangler authentication failed. Please ensure you have a valid .env file with CLOUDFLARE_API_TOKEN or run 'wrangler login' in a browser-enabled environment."
  exit 1
fi

# Step 2: KV namespace setup
CONFIG_KV="CONFIG_KV"
SESSIONS_KV="SESSIONS_KV"
CHAT_HISTORY_KV="CHAT_HISTORY_KV"
NAMESPACES=($CONFIG_KV $SESSIONS_KV $CHAT_HISTORY_KV)

echo "Checking for existing KV namespaces..."
EXISTING=$(wrangler kv namespace list | grep '"title"' | awk -F '"' '{print $4}')

for NS in "${NAMESPACES[@]}"; do
  if echo "$EXISTING" | grep -q "^$NS$"; then
    echo "Namespace $NS already exists. Skipping creation."
  else
    echo "Creating namespace $NS..."
    wrangler kv namespace create "$NS"
  fi
done

# Step 3: .env setup
if [ ! -f .env ]; then
  echo "No .env file found. Creating one."
  read -p "Enter your CLOUDFLARE_API_TOKEN: " TOKEN
  echo "CLOUDFLARE_API_TOKEN=$TOKEN" > .env
else
  echo ".env file already exists."
fi

# Step 4: Prompt for secret if not set
if ! wrangler secret list | grep -q "COPILOT_CLOUDFLARE_GLOBAL"; then
  echo "COPILOT_CLOUDFLARE_GLOBAL secret not set."
  echo "You will be prompted to enter it."
  wrangler secret put COPILOT_CLOUDFLARE_GLOBAL
else
  echo "COPILOT_CLOUDFLARE_GLOBAL secret already set."
fi

# Step 5: Create public directory if missing
if [ ! -d "public" ]; then
  echo "Creating public directory."
  mkdir public
  echo "<html><body><h1>Hello, World!</h1></body></html>" > public/index.html
else
  echo "public directory already exists."
fi

# Step 6: Start local dev server
echo "Starting local development server..."
npm run dev
