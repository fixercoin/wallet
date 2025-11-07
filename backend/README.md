# Fixorium Backend - Express.js Server

This is the Express.js backend for the Fixorium Wallet application. It provides API endpoints for Solana blockchain operations, token pricing, and p2p trading.

## Quick Start

### Development

```bash
npm install
npm run dev
```

Server will start on `http://localhost:10000`

### Production

```bash
npm install
npm start
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key variables:

- `PORT`: Server port (default: 10000)
- `NODE_ENV`: Environment (development/production)
- `SOLANA_RPC_URL`: Primary Solana RPC endpoint
- `FIXORIUM_API_KEY`: API key for protected endpoints (optional)
- `CORS_ORIGIN`: Frontend origin for CORS (e.g., https://fixorium.netlify.app)

## API Endpoints

### Wallet Operations

- `GET /api/wallet/balance?publicKey=<address>` - Get wallet SOL balance
- `GET /api/balance?publicKey=<address>` - Alias for wallet balance

### Pricing

- `GET /api/dexscreener/tokens?tokens=<mint1>,<mint2>` - Get token prices from DexScreener
- `GET /api/exchange-rate?token=FIXERCOIN` - Get exchange rate with markup
- `GET /api/sol/price` - Get SOL price
- `GET /api/token/price?mint=<mint>` - Get any token price

### Swaps & Quotes

- `GET /api/quote?inputMint=<mint>&outputMint=<mint>&amount=<amount>` - Get swap quote
- `POST /api/swap` - Build unsigned swap transaction
- `GET /api/swap/quote` - V2 quote endpoint
- `POST /api/swap/execute` - V2 swap execution

### Orders

- `GET /api/orders` - List all orders
- `POST /api/orders` - Create new order
- `GET /api/orders/:orderId` - Get order details
- `PUT /api/orders/:orderId` - Update order
- `DELETE /api/orders/:orderId` - Delete order

### Trading Rooms (P2P)

- `GET /api/p2p/rooms` - List all trading rooms
- `POST /api/p2p/rooms` - Create new room
- `GET /api/p2p/rooms/:roomId` - Get room details
- `GET /api/p2p/rooms/:roomId/messages` - Get room messages
- `POST /api/p2p/rooms/:roomId/messages` - Send message

### Solana RPC

- `POST /api/solana-rpc` - Proxy Solana JSON-RPC calls

### Health & Status

- `GET /api/ping` - Simple ping endpoint
- `GET /api/health` - Health check
- `GET /api` - API info

## Deployment on Render

### 1. Connect Repository

- Push code to GitHub
- Go to [Render](https://render.com)
- Create new "Web Service"
- Connect your GitHub repository

### 2. Configure Build Settings

In Render dashboard:

- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Environment**: Node
- **Node Version**: 18+ (select from dropdown)

### 3. Set Environment Variables

In Render dashboard, add to Environment:

```
PORT=10000
NODE_ENV=production
SOLANA_RPC_URL=https://solana.publicnode.com
FIXORIUM_API_KEY=your-secure-key-here
CORS_ORIGIN=https://your-netlify-frontend.netlify.app
```

### 4. Deploy

- Click "Deploy" button
- Service will build and start automatically
- Your API will be available at: `https://your-service-name.onrender.com`

### 5. Configure Frontend

In your Netlify environment variables:

```
VITE_API_URL=https://your-service-name.onrender.com
```

## File Structure

```
backend/
├── index.js                 # Main Express server
├── package.json             # Dependencies
├── .env.example            # Environment template
├── middleware/
│   ├── auth.js             # API key validation
│   └── validate.js         # Request validation
└── routes/
    ├── solana-proxy.js     # Solana RPC proxy
    ├── wallet-balance.js   # Wallet operations
    ├── orders.js           # Order management
    ├── dexscreener-proxy.js# Token pricing
    ├── swap-proxy.js       # Swap operations
    └── ... (other routes)
```

## Architecture Notes

- **Single port**: All APIs on one port (10000)
- **CORS enabled**: Accepts requests from configured frontend origin
- **No serverless**: Standard Express.js app, works on any Node.js hosting
- **Stateless**: In-memory data stores (use database for production)
- **Extensible**: Easy to add new routes in `routes/` folder

## Troubleshooting

### Port Already in Use

```bash
# Change port in .env
PORT=10001
```

### CORS Errors

Ensure `CORS_ORIGIN` environment variable matches your frontend URL exactly (including protocol and domain).

### RPC Connection Issues

- Check `SOLANA_RPC_URL` is valid
- Verify network connectivity
- App will automatically failover between multiple RPC endpoints

### API Key Validation

Protected endpoints require either:

- `Authorization: Bearer <FIXORIUM_API_KEY>` header, or
- `x-api-key: <FIXORIUM_API_KEY>` header

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure proper `SOLANA_RPC_URL`
- [ ] Set strong `FIXORIUM_API_KEY`
- [ ] Configure `CORS_ORIGIN` to match frontend
- [ ] Enable HTTPS (handled by Render)
- [ ] Monitor logs in Render dashboard
- [ ] Set up alerts for crashes

## Support

For issues or questions, check:

- Render logs: Dashboard → Service → Logs
- API health: `GET https://your-service.onrender.com/api/health`
- Error details in response JSON
