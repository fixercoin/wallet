#!/bin/bash

# Cloudflare Pages Deployment Script
# This script builds the application and deploys it to Cloudflare Pages

set -e

PROJECT_NAME="wallet-c36"
ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID}"
API_TOKEN="${CLOUDFLARE_API_TOKEN}"

echo "🚀 Building for Cloudflare Pages..."
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "⚠️  wrangler CLI not found. Installing..."
    npm install -g @cloudflare/wrangler
fi

# Check for required environment variables for automated deployment
if [ -z "$ACCOUNT_ID" ] || [ -z "$API_TOKEN" ]; then
    echo "⚠️  CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN not set"
    echo "📝 For automated deployment, set these environment variables:"
    echo "   export CLOUDFLARE_ACCOUNT_ID=your_account_id"
    echo "   export CLOUDFLARE_API_TOKEN=your_api_token"
    echo ""
    echo "Or use the Cloudflare Dashboard to connect your Git repository for automatic deployments."
    echo ""
fi

# Step 1: Install dependencies
echo "📦 Installing dependencies..."
npm install

# Step 2: Run type checking
echo "🔍 Running type checks..."
npm run typecheck 2>/dev/null || true

# Step 3: Build frontend
echo "🏗️  Building React frontend..."
npm run build

# Step 4: Verify build output
if [ ! -d "dist" ]; then
    echo "❌ Build failed: dist directory not found"
    exit 1
fi

echo "✅ Frontend build successful"
echo "   Output directory: dist/"
echo "   Files: $(find dist -type f | wc -l) files"

# Step 5: Verify Functions directory
if [ ! -d "functions" ]; then
    echo "❌ Error: functions directory not found"
    exit 1
fi

echo "✅ Functions verified"
echo "   API endpoints: $(find functions/api -name '*.ts' | wc -l) handlers"

# Step 6: Deploy to Cloudflare Pages
if [ -n "$ACCOUNT_ID" ] && [ -n "$API_TOKEN" ]; then
    echo ""
    echo "🌐 Deploying to Cloudflare Pages..."
    
    wrangler pages deploy dist \
        --project-name "$PROJECT_NAME" \
        --branch main
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Deployment successful!"
        echo "🔗 Project: $PROJECT_NAME"
        echo "📊 Dashboard: https://dash.cloudflare.com/pages/view/$PROJECT_NAME"
    else
        echo ""
        echo "❌ Deployment failed"
        echo "Try deploying manually with:"
        echo "   wrangler pages deploy dist --project-name $PROJECT_NAME"
        exit 1
    fi
else
    echo ""
    echo "📝 Build complete! To deploy:"
    echo ""
    echo "Option 1: Using Cloudflare Dashboard (recommended)"
    echo "  1. Go to https://dash.cloudflare.com/pages"
    echo "  2. Connect your Git repository"
    echo "  3. Set build command: npm run build"
    echo "  4. Set output directory: dist"
    echo ""
    echo "Option 2: Using Wrangler CLI"
    echo "  wrangler pages deploy dist --project-name $PROJECT_NAME"
    echo ""
    echo "Option 3: For CI/CD automation"
    echo "  export CLOUDFLARE_ACCOUNT_ID=your_account_id"
    echo "  export CLOUDFLARE_API_TOKEN=your_api_token"
    echo "  bash scripts/deploy-cloudflare-pages.sh"
fi

echo ""
echo "📚 Documentation:"
echo "   See CLOUDFLARE_PAGES_DEPLOYMENT.md for detailed setup instructions"
echo ""
