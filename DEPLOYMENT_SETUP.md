# Complete Deployment Guide: Netlify Frontend + Render Backend

This guide explains how to deploy your Fixorium Wallet application with:
- **Frontend**: Netlify (static site hosting)
- **Backend**: Render (Node.js hosting)

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Fixorium Architecture                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────┐         ┌────────────────────┐   │
│  │  Frontend (Netlify)  │         │  Backend (Render)  │   │
│  │  - React SPA         │◄───────►│  - Express.js      │   │
│  │  - Static build      │  /api   │  - Node.js         │   │
│  │  - CDN hosted        │  calls  │  - Solana APIs     │   │
│  └──────────────────────┘         └────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          External Services (Solana, etc)             │   │
│  │  - DexScreener, Jupiter, Pumpfun, etc                │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- GitHub account (to push code)
- Netlify account (free at https://netlify.com)
- Render account (free at https://render.com)
- Node.js 18+ locally (for testing)

## Step 1: Prepare the Repository

Your project is already structured with separate frontend and backend folders:

```
project/
├── frontend/              # Netlify deployment
│   ├── package.json
│   ├── vite.config.mjs
│   ├── netlify.toml       # Netlify build config
│   ├── .env.example
│   └── index.html
├── backend/               # Render deployment
│   ├── package.json
│   ├── index.js           # Main server
│   ├── .env.example
│   ├── middleware/
│   └── routes/
├── client/                # React source (used by frontend)
└── package.json          # Root package (for reference only)
```

### Verify Structure Locally

```bash
# Test frontend build
cd frontend
npm install
npm run build
# Should create frontend/dist/ folder

# Test backend
cd ../backend
npm install
npm start
# Should listen on port 10000
```

## Step 2: Deploy Frontend to Netlify

### Option A: Using Netlify UI (Recommended for First-Time Users)

1. **Push code to GitHub**
   ```bash
   git add .
   git commit -m "Setup for Netlify and Render deployment"
   git push origin main
   ```

2. **Go to [Netlify](https://netlify.com)**
   - Click "Add new site" → "Import an existing project"
   - Connect your GitHub repository
   - Choose your GitHub account and repository

3. **Configure Build Settings**
   - Build command: `cd frontend && npm run build`
   - Publish directory: `frontend/dist`
   - Click "Deploy site"

4. **Set Environment Variables**
   - In Netlify dashboard: Site settings → Build & deploy → Environment
   - Add variable: `VITE_API_URL` = `https://your-backend-service.onrender.com`
   - Trigger redeploy

### Option B: Using netlify.toml (Automatic)

The project includes `frontend/netlify.toml` which is automatically detected by Netlify.

Simply connect your repository and it will use the config from `netlify.toml`:
- Build command: `npm run build`
- Publish directory: `dist`

## Step 3: Deploy Backend to Render

1. **Go to [Render](https://render.com)**
   - Sign up or log in
   - Click "New+" → "Web Service"
   - Connect your GitHub repository

2. **Configure Service**
   - **Name**: `fixorium-api` (or your preferred name)
   - **Runtime**: Node
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
   - **Plan**: Free (for testing) or Starter+ (for production)

3. **Set Environment Variables**
   Click "Advanced" and add these variables:
   ```
   PORT=10000
   NODE_ENV=production
   SOLANA_RPC_URL=https://solana.publicnode.com
   FIXORIUM_API_KEY=your-super-secret-api-key-here
   CORS_ORIGIN=https://your-netlify-frontend.netlify.app
   ```

   Replace:
   - `your-netlify-frontend.netlify.app` with your actual Netlify domain
   - `your-super-secret-api-key-here` with a secure key

4. **Deploy**
   - Click "Create Web Service"
   - Render will build and deploy automatically
   - Your API URL will be: `https://fixorium-api.onrender.com`

## Step 4: Update Frontend to Point to Backend

After Render deployment completes:

1. **Get your Render service URL**
   - In Render dashboard, find your service URL (usually `https://fixorium-api.onrender.com`)

2. **Update Netlify environment variable**
   - Go to Netlify dashboard → Site settings → Build & deploy → Environment
   - Update `VITE_API_URL` to your Render service URL
   - Click "Trigger deploy" to rebuild

3. **Verify Connection**
   - Visit your frontend: `https://your-site.netlify.app`
   - Open browser console (F12)
   - Check Network tab for API calls to your Render backend
   - Test a feature that calls `/api/*` endpoints

## Step 5: Verify Deployment

### Test Frontend
```bash
# Visit your Netlify site
https://your-site.netlify.app

# Check in browser console:
# - No CORS errors
# - API calls to correct backend URL
# - Page loads without 404 errors
```

### Test Backend
```bash
# Check service is running
curl https://your-backend-service.onrender.com/api/health

# Should return:
# {"status":"ok","timestamp":"...","environment":"server","uptime":123}
```

### Test Full Integration
1. Go to your frontend
2. Click any button that calls an API (e.g., wallet balance)
3. Should see successful responses in Network tab

## Step 6: Custom Domain (Optional)

### For Frontend (Netlify)
1. In Netlify: Site settings → Domain management → Custom domains
2. Add your domain (e.g., `fixorium.com`)
3. Update DNS records per Netlify instructions
4. Enable HTTPS (automatic)

### For Backend (Render)
1. In Render: Service settings → Custom domain
2. Add your domain (e.g., `api.fixorium.com`)
3. Update DNS records
4. HTTPS is automatic

## Troubleshooting

### Frontend Can't Connect to Backend

**Problem**: CORS errors or "API is unreachable"

**Solutions**:
1. Verify `VITE_API_URL` in Netlify environment variables
2. Check Render service URL is correct
3. In browser console, test: `fetch('https://backend-url.onrender.com/api/ping')`
4. Verify `CORS_ORIGIN` in Render matches your Netlify domain exactly

### Backend Service Sleeps After 15 Minutes (Free Plan)

On Render's free plan, services spin down after 15 minutes of inactivity.
- Solution: Upgrade to Starter+ plan, or
- Keep a simple health check monitoring service active

### Build Failures on Netlify

**Check logs**: Site settings → Deploy → Deploys → Click failed deploy

Common issues:
- Missing dependencies: Check `frontend/package.json`
- Build errors: Check `npm run build` locally first
- Wrong build directory: Should be `frontend/dist`

### Build Failures on Render

**Check logs**: Service → Logs tab

Common issues:
- Wrong Node version: Ensure 18+
- Missing environment variables: All `.env` vars must be set
- TypeScript errors: All JS files should be syntax correct

## Updating Deployment

### Push Code Changes

```bash
# Make changes to client, frontend, or backend
git add .
git commit -m "Your changes"
git push origin main
```

### Redeploy Frontend
- Netlify automatically rebuilds on each push
- Or manually trigger: Site settings → Deploys → Trigger deploy

### Redeploy Backend
- Render automatically rebuilds on each push
- Or manually trigger: Service → Manual Deploy

## Environment Variables Reference

### Frontend (.env in Netlify)
```
VITE_API_URL=https://your-backend-service.onrender.com
```

### Backend (.env on Render)
```
PORT=10000
NODE_ENV=production
SOLANA_RPC_URL=https://solana.publicnode.com
FIXORIUM_API_KEY=your-secret-key
CORS_ORIGIN=https://your-netlify-app.netlify.app
```

## Security Checklist

- [ ] Set strong `FIXORIUM_API_KEY` (use random string generator)
- [ ] Ensure `CORS_ORIGIN` is exact match (no trailing slash)
- [ ] Don't commit `.env` files (use `.env.example` instead)
- [ ] Use HTTPS everywhere (Netlify and Render handle this)
- [ ] Regularly update dependencies: `npm audit fix`
- [ ] Monitor logs for errors: Check dashboards weekly
- [ ] Set up Render monitoring for uptime alerts

## Production Optimization

### Frontend
- Build output is minified automatically
- Cloudflare CDN speeds up delivery
- Enable analytics in Netlify dashboard

### Backend
- Upgrade from Free to Starter+ plan
- Use environment-specific RPC endpoints
- Monitor API usage and response times
- Set up database for persistent orders (currently in-memory)

## Next Steps

1. **Custom Domain**: Set up your own domain
2. **Database**: Replace in-memory stores with real database (MongoDB, PostgreSQL, etc.)
3. **Monitoring**: Set up alerts for errors and downtime
4. **Analytics**: Track user behavior and API metrics
5. **Payments**: Integrate payment processor for real trading

## Support Resources

- **Netlify Docs**: https://docs.netlify.com/
- **Render Docs**: https://render.com/docs
- **Express.js Docs**: https://expressjs.com/
- **Vite Docs**: https://vitejs.dev/
- **React Router Docs**: https://reactrouter.com/

## Quick Reference

| Service | URL | Dashboard | Status |
|---------|-----|-----------|--------|
| Frontend | https://your-site.netlify.app | https://app.netlify.com | ��� |
| Backend | https://your-api.onrender.com | https://dashboard.render.com | ✓ |
| API Health | /api/health | Check logs | ✓ |
| Ping Test | GET /api/ping | Response code 200 | ✓ |
