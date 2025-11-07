# Quick Deploy to Cloudflare Pages

Get your serverless wallet app live in minutes!

## 🚀 Fastest Way (Automatic via Git)

### Step 1: Connect Your Repository

1. Go to https://dash.cloudflare.com/pages
2. Click **"Create a project"** → **"Connect to Git"**
3. Authorize Cloudflare and select your repository
4. Click **"Begin setup"**

### Step 2: Configure Build

- **Framework preset**: None
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- Click **"Save and Deploy"**

### Step 3: Set Environment Variables

1. Go to **Settings** → **Environment variables**
2. Add:
   ```
   SOLANA_RPC = https://rpc.shyft.to?api_key=3hAwrhOAmJG82eC7
   BIRDEYE_API_KEY = cecae2ad38d7461eaf382f533726d9bb
   ```
3. Click **"Save"**

### Step 4: Deploy

- Push to your main branch:
  ```bash
  git push origin main
  ```
- Cloudflare automatically builds and deploys!
- Your app is live in ~2 minutes

**That's it!** 🎉 Your app is now on Cloudflare Pages with Jupiter v6 integration.

---

## ⚡ Manual Deployment (Wrangler CLI)

### Step 1: Install Wrangler

```bash
npm install -g @cloudflare/wrangler
```

### Step 2: Build

```bash
npm run build
```

### Step 3: Deploy

```bash
wrangler pages deploy dist --project-name wallet-c36
```

### Step 4: Set Secrets (Optional)

```bash
wrangler secret put SOLANA_RPC
# Paste: https://rpc.shyft.to?api_key=YOUR_KEY
# Press Enter twice

wrangler secret put BIRDEYE_API_KEY
# Paste: your_api_key
# Press Enter twice
```

---

## 🧪 Test Locally First

### Start Dev Server

```bash
npm install          # Install dependencies
npm run dev          # Start dev server
```

Open http://localhost:5173 in your browser.

### Test Jupiter Swap

```bash
curl "http://localhost:5173/api/jupiter/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump&amount=1000000000"
```

### Test Wallet Balance

```bash
curl "http://localhost:5173/api/wallet/balance?publicKey=YOUR_WALLET_ADDRESS"
```

---

## 📋 Pre-Deployment Checklist

- [ ] Code pushed to Git repository
- [ ] `npm run build` succeeds locally
- [ ] No TypeScript errors: `npm run typecheck`
- [ ] Cloudflare Pages account ready
- [ ] API keys available
  - [ ] Solana RPC endpoint
  - [ ] Birdeye API key (optional)

---

## 🔍 After Deployment

### Monitor Your App

```bash
# View real-time logs
wrangler tail --project-name wallet-c36
```

### Check Status

- **Dashboard**: https://dash.cloudflare.com/pages/view/wallet-c36
- **Logs**: Real-time request logs and errors
- **Analytics**: Request count, latency, errors

### Your Live URL

```
https://wallet-c36.pages.dev
```

---

## 🆘 Troubleshooting

### Build Fails

```bash
# Check for errors
npm run build
npm run typecheck

# Check dependencies
npm install
```

### Functions Return 404

- Verify `functions/api/` directory exists
- Check file paths match routes
- Rebuild: `npm run build`

### API Timeout

- Check Solana RPC health: https://rpc.shyft.to
- Reduce slippage or token count
- Try different RPC endpoint

### CORS Errors

- All functions have CORS headers enabled
- Check browser console for actual error
- Verify endpoint path is correct

---

## 📚 Learn More

- **Deployment Guide**: See `CLOUDFLARE_PAGES_DEPLOYMENT.md`
- **API Reference**: See `SERVERLESS_API_GUIDE.md`
- **Full Setup**: See `SERVERLESS_IMPLEMENTATION_SUMMARY.md`

---

## 💡 Pro Tips

1. **Use GitHub Actions for CI/CD**
   - Automatic tests before deploy
   - Conditional deployments

2. **Set Up Alerts**
   - Email on deployment failure
   - High error rate alerts

3. **Custom Domain**
   - Add your domain in Pages settings
   - Free SSL certificate included

4. **Optimize for Speed**
   - Enable caching with KV store
   - Batch price requests
   - Cache quote responses

5. **Monitor Costs**
   - API calls: $0.50 per million
   - Most projects cost <$1/month
   - See Cloudflare pricing

---

## 🎯 Next Steps

1. ✅ Deploy this week
2. ✅ Test all swap functions
3. ✅ Set up monitoring
4. ✅ Share with users
5. ✅ Scale as needed

---

**Questions?** Check the documentation files or visit Cloudflare Pages docs: https://developers.cloudflare.com/pages/
