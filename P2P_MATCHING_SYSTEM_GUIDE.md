# P2P Smart Matching System - Implementation Guide

## Overview

This guide explains the new **Binance-like smart P2P order matching system** for your Solana wallet application.

## Architecture

### Core Components

#### 1. **Matching Engine** (`server/lib/p2p-matching-engine.ts`)

Smart algorithm that matches BUY and SELL orders based on:

- **Price Compatibility**: Buyer's max price ≥ Seller's min price (with configurable deviation)
- **Amount Overlap**: Trade amount must satisfy both parties' min/max requirements
- **Token Match**: Both orders trade the same token
- **Payment Method**: Both orders accept the same payment method (Easypaisa)
- **Wallet Validation**: No self-matching (different wallets)

**Matching Score** considers:
1. Amount overlap size (larger overlap = higher score)
2. Price proximity (closer prices = higher score)
3. Response time (newer orders get slight boost)

Returns **top 5 best matches** for any given order.

#### 2. **Reputation System** (`server/lib/p2p-reputation.ts`)

Tracks merchant statistics:

- **Total Trades**: Lifetime transaction count
- **Completion Rate**: % of completed trades (target: >95%)
- **Response Time**: Average response time in minutes
- **Trading Volume**: Total PKR and crypto traded
- **Rating**: 1-5 star rating calculated from completion rate
- **Level**: NOVICE → INTERMEDIATE → ADVANCED → PRO

**Level Progression**:
- NOVICE: < 10 trades or < 95% completion
- INTERMEDIATE: 10-49 trades, < 98% completion
- ADVANCED: 50-199 trades, < 99% completion
- PRO: 200+ trades, 99%+ completion

#### 3. **Matching Routes** (`server/routes/p2p-matching.ts`)

API endpoints for matching functionality:

```
GET  /api/p2p/matches?orderId=xxx           # Get matches for order
POST /api/p2p/matches                       # Create matched pair
GET  /api/p2p/matches/:matchId              # Get match details
PUT  /api/p2p/matches/:matchId              # Update match status
GET  /api/p2p/matches/list/all?wallet=xxx   # List wallet matches
DELETE /api/p2p/matches/:matchId            # Cancel match
```

#### 4. **Client APIs** (`client/lib/p2p-matching-api.ts`)

JavaScript interface for frontend:

```typescript
// Get matches for a specific order
const { matches, order } = await getMatchesForOrder(orderId);

// Create a matched pair (initiate trade)
const { matchedPair, tradeRoomId } = await createMatchedPair(buyOrderId, sellOrderId);

// Get match details with stats
const match = await getMatchedPair(matchId);

// List all matches for a wallet
const matches = await getMatchesForWallet(walletAddress);

// Update match status
await updateMatchedPairStatus(matchId, "PAYMENT_CONFIRMED");
```

#### 5. **UI Components** 

- `client/components/P2PMatches.tsx`: Display matched orders with trader stats
- `client/hooks/use-p2p-matching.ts`: React hook for real-time matching polling

## How Matching Works

### Order Creation Flow

```
1. User creates order (BUY or SELL)
   - Specifies: token, amount PKR, price, payment method

2. Order stored as PENDING in Cloudflare KV
   - Can now be matched with opposite orders

3. Matching Engine scans all PENDING orders
   - Filters by: token, payment method, compatible amounts
   - Scores candidates by price & amount fit
   - Returns top 5 matches ranked by compatibility

4. User sees available matches
   - Displays trader rating, completion %, volume
   - One-click acceptance to initiate trade

5. Match acceptance creates:
   - Matched pair record (status: PENDING)
   - Trade room for P2P communication
   - Both orders marked as MATCHED
```

### Matching Algorithm Priority

```
1. Amount Overlap (40% weight)
   - Larger overlap between min/max amounts = higher score

2. Price Proximity (35% weight)
   - Closer prices = higher score
   - Max deviation configurable (default 2%)

3. Merchant Rating (15% weight)
   - Higher rated traders prioritized

4. Response Time (10% weight)
   - Newer orders get slight boost
```

## Configuration

### Matching Criteria

Customize matching behavior via `MatchingCriteria`:

```typescript
interface MatchingCriteria {
  maxPriceDeviation?: number;  // Max % price difference (default: 2%)
  minAmount?: number;          // Minimum trade amount in PKR (default: 100)
  maxAmount?: number;          // Maximum trade amount in PKR (default: 1,000,000)
}

// Usage
const matches = await getMatchesForOrder(orderId, {
  maxPriceDeviation: 5,  // Allow up to 5% price difference
  minAmount: 500,
  maxAmount: 500000,
});
```

### Reputation Level Thresholds

Adjust in `server/lib/p2p-reputation.ts`:

```typescript
function determineLevel(stats: MerchantStats): MerchantStats["level"] {
  if (totalTrades < 10 || completionRate < 95) return "NOVICE";
  if (totalTrades < 50 || completionRate < 98) return "INTERMEDIATE";
  if (totalTrades < 200 || completionRate < 99) return "ADVANCED";
  return "PRO";
}
```

## Real-time Updates

**Polling Strategy** (Cloudflare Pages limitation):

- Frontend polls for matches every **5 seconds** (configurable)
- Polling stops on component unmount
- Manual refresh available on-demand
- Exponential backoff on errors

```typescript
// Automatic polling with hook
const { matches, loading } = useP2PMatching({
  orderId: "order-123",
  pollInterval: 5000,  // Check every 5 seconds
  enabled: true,
});

// Manual polling
await refetchMatches();
```

## Usage Examples

### Example 1: User Creates a SELL Order

```typescript
// User wants to sell 0.5 SOL for PKR
const order = await createOrder(
  walletAddress,
  "SELL",
  "SOL",
  0.5,
  42000,  // PKR amount
  "EASYPAISA",
);

// Check for matches
const { matches } = await getMatchesForOrder(order.id);

// Display: "Found 3 buy orders matching your offer"
// - Order A: Rate ⭐4.8, Pro trader, 1,250+ trades
// - Order B: Rate ⭐4.2, Advanced, 82 trades  
// - Order C: Rate ⭐3.9, Intermediate, 15 trades

// User clicks "Accept Match with Order A"
const { matchedPair, tradeRoomId } = await createMatchedPair(
  order.id,  // Sell order
  "buyorder-123"  // Buy order from matching
);

// Trade room created, users can now communicate
```

### Example 2: User Views Available Matches

```typescript
// In P2PActiveOrders page
const { wallet } = useWallet();

const { matches, loading } = useP2PMatching({
  walletAddress: wallet?.publicKey,
  pollInterval: 5000,
});

// Render P2PMatches component
<P2PMatches orderType="BUY" autoRefresh={true} />
```

### Example 3: Tracking Merchant Reputation

```typescript
// Get trader stats
const stats = await getMerchantStats(walletAddress);

console.log({
  rating: stats.rating,           // 4.8/5.0
  level: stats.level,             // "PRO"
  completionRate: stats.completionRate,  // 99.2%
  totalTrades: stats.totalTrades, // 1,250
  totalVolumePKR: stats.totalVolumePKR,  // 85,000,000 PKR
});
```

## Current Limitations & Future Improvements

### Current (Cloudflare Pages)
- ✅ Deterministic matching algorithm
- ✅ Merchant reputation tracking
- ✅ KV storage for persistence
- ✅ Polling-based real-time (5s interval)
- ⚠️ No WebSocket (not supported on Pages)

### Future Enhancements
- [ ] WebSocket integration (requires traditional backend)
- [ ] Machine learning for improved matching
- [ ] Automated dispute resolution
- [ ] Payment verification integration
- [ ] Mobile app optimization
- [ ] Advanced filters (location, payment speed, etc.)

## Database Schema (KV Storage)

```
Key Format          | Value
--------------------|------
orders:{orderId}    | P2POrder object
orders:wallet:{addr}| Array of order IDs
p2p_matched_{id}    | MatchedPair object
p2p_merchant_stats_{wallet} | MerchantStats object
p2p_merchant_trades_{wallet}| Array of TradeRecords
trade_rooms:{roomId}| TradeRoom object
```

## Error Handling

Common error scenarios:

```typescript
try {
  const matches = await getMatchesForOrder(orderId);
} catch (error) {
  if (error.message.includes("Order not found")) {
    // Handle order not found
  } else if (error.message.includes("No matches")) {
    // Show "no matches available" message
  }
}
```

## Testing the Matching System

### Manual Test Scenario

1. **Create two wallets** (Test Wallet A & B)
2. **Wallet A creates SELL order**: 0.5 SOL @ 280 PKR/SOL
3. **Wallet B creates BUY order**: 0.5 SOL @ 285 PKR/SOL
4. **Check matches**:
   - Wallet A sees Wallet B's buy order as match ✓
   - Wallet B sees Wallet A's sell order as match ✓
5. **Accept match**: Both wallets trade room created ✓
6. **Check reputation**: Both wallets' stats updated after trade ✓

## Support & Documentation

For issues or questions:
- Check `server/routes/p2p-matching.ts` for detailed endpoint docs
- Review `client/lib/p2p-matching-api.ts` for client API signatures
- See `server/lib/p2p-matching-engine.ts` for algorithm details

---

**Last Updated**: January 2025
**Version**: 1.0.0 (Stable)
**Status**: Production Ready ✓
