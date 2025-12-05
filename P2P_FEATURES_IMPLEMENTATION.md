# P2P Platform Features Implementation

This guide covers the three core P2P features implemented:

1. **Real-time Order Updates** (Polling-based)
2. **Escrow/Fund Holding System** (KV-backed)
3. **Admin Dispute Resolution** (Manual review)

## Architecture Overview

```
Client (React)
    ↓
API Endpoints (/api/p2p/*)
    ↓
Cloudflare Functions
    ↓
Cloudflare KV Storage
```

---

## 1. Real-Time Order Updates (Polling)

### How It Works

- **Polling Interval**: 3 seconds (configurable)
- **Technology**: Client-side polling using custom hook
- **Scope**: Automatically fetches order updates for connected wallet

### Files Created/Modified

**New:**

- `client/hooks/use-p2p-polling.ts` - Custom hook for polling orders

**Modified:**

- `client/pages/BuyActiveOrders.tsx` - Integrated polling
- `client/pages/SellActiveOrders.tsx` - Integrated polling

### Usage Example

```typescript
import { useP2PPolling } from "@/hooks/use-p2p-polling";

function MyComponent() {
  const [orders, setOrders] = useState([]);

  // Polls for order updates every 3 seconds
  useP2PPolling(
    (fetchedOrders) => {
      setOrders(fetchedOrders);
    },
    {
      walletAddress: wallet?.publicKey,
      status: "PENDING",
      pollInterval: 3000,
      enabled: !!wallet?.publicKey,
    }
  );

  return <div>{/* Orders list */}</div>;
}
```

### API Endpoint Used

```
GET /api/p2p/orders?wallet=<wallet>&status=<status>
```

**Response:**

```json
{
  "success": true,
  "data": [...],
  "count": 5
}
```

---

## 2. Escrow/Fund Holding System

### How It Works

- **Status Flow**: LOCKED → RELEASED/REFUNDED/DISPUTED
- **Storage**: Cloudflare KV with wallet-indexed keys
- **Fund Control**: Locked until order completion or dispute resolution

### Files Created/Modified

**New:**

- `functions/api/p2p/escrow.ts` - Escrow management API
- `functions/lib/kv-utils.ts` (extended) - Escrow KV methods
- `client/lib/p2p-escrow.ts` - Client utilities

**Modified:**

- `functions/lib/kv-utils.ts` - Added Escrow interface & methods

### Escrow Lifecycle

```
Order Created (PENDING)
    ↓
Match Confirmed
    ↓
Escrow Created (LOCKED) - Funds secured
    ↓
Payment Confirmed by Buyer
    ↓
Assets Transferred by Seller
    ↓
Escrow Released (RELEASED) - Seller gets paid
    OR
Dispute Initiated (DISPUTED)
    ↓
Admin Resolves (via Disputes API)
    ↓
Escrow Finalized (RELEASED/REFUNDED)
```

### Creating an Escrow

```typescript
import { createEscrow } from "@/lib/p2p-escrow";

const escrow = await createEscrow(
  orderId,
  buyerWalletAddress,
  sellerWalletAddress,
  amountPKR,
  amountTokens,
  token
);

// Response
{
  id: "escrow_1234...",
  orderId: "order_5678...",
  buyerWallet: "buyer_address",
  sellerWallet: "seller_address",
  amountPKR: 10000,
  amountTokens: 100,
  token: "SOL",
  status: "LOCKED",
  createdAt: 1234567890,
  updatedAt: 1234567890
}
```

### Updating Escrow Status

```typescript
import { updateEscrowStatus } from "@/lib/p2p-escrow";

const updated = await updateEscrowStatus(
  escrowId,
  "RELEASED", // or "REFUNDED", "DISPUTED"
);
```

### API Endpoints

**Create Escrow:**

```
POST /api/p2p/escrow
{
  "orderId": "order_123",
  "buyerWallet": "addr1",
  "sellerWallet": "addr2",
  "amountPKR": 10000,
  "amountTokens": 100,
  "token": "SOL"
}
```

**Get Escrow:**

```
GET /api/p2p/escrow?id=<escrowId>
GET /api/p2p/escrow?orderId=<orderId>
```

**Update Status:**

```
PUT /api/p2p/escrow
{
  "escrowId": "escrow_123",
  "status": "RELEASED"
}
```

---

## 3. Admin Dispute Resolution

### How It Works

- **Initiation**: Users can create disputes for locked escrows
- **Review**: Admin panel shows all open disputes
- **Resolution**: Admin manually decides: RELEASE_TO_SELLER, REFUND_TO_BUYER, or SPLIT

### Files Created/Modified

**New:**

- `functions/api/p2p/disputes.ts` - Dispute management API
- `functions/lib/kv-utils.ts` (extended) - Dispute KV methods
- `client/lib/p2p-disputes.ts` - Client utilities
- `client/pages/AdminDisputes.tsx` - Admin UI panel

**Modified:**

- `functions/lib/kv-utils.ts` - Added Dispute interface & methods
- `client/App.tsx` - Added route `/p2p/admin-disputes`

### Creating a Dispute

```typescript
import { createDispute } from "@/lib/p2p-disputes";

const dispute = await createDispute(
  escrowId,
  orderId,
  userWalletAddress,
  "Payment not received after 2 hours",
  ["proof_link_1", "screenshot_url"],
);
```

### Admin Panel

Access at: `/p2p/admin-disputes` (Admin wallet only)

**Features:**

- View all open disputes
- See dispute details (reason, evidence)
- Select resolution type
- Automatically updates escrow status after resolution

### API Endpoints

**Create Dispute:**

```
POST /api/p2p/disputes
{
  "escrowId": "escrow_123",
  "orderId": "order_456",
  "initiatedBy": "wallet_address",
  "reason": "Payment not received",
  "evidence": ["link1", "link2"]
}
```

**Get Disputes:**

```
GET /api/p2p/disputes              # All disputes
GET /api/p2p/disputes?filter=open  # Open disputes only
GET /api/p2p/disputes?id=<id>      # Single dispute
```

**Resolve Dispute:**

```
PUT /api/p2p/disputes
{
  "disputeId": "dispute_123",
  "resolution": "RELEASE_TO_SELLER",  // or "REFUND_TO_BUYER", "SPLIT"
  "resolvedBy": "admin_wallet_address"
}
```

---

## Integration Guide: Complete Flow

### Step 1: User Creates Order

```typescript
const order = await createOrder(
  wallet.publicKey,
  "BUY",
  "SOL",
  100,
  10000,
  paymentMethodId,
);
```

### Step 2: Match Confirmation (When another user wants to take the order)

```typescript
// Buyer and Seller agree
// Create escrow to lock funds
const escrow = await createEscrow(
  order.id,
  buyerWallet,
  sellerWallet,
  order.amountPKR,
  order.amountTokens,
  order.token,
);

// Update order status
await updateOrderStatus(order.id, "ESCROW_LOCKED");

// Store escrow reference in order
order.escrowId = escrow.id;
order.matchedWith = otherPartyWallet;
```

### Step 3: Trade Execution

**Buyer perspective:**

1. Confirms payment sent
2. Waits for seller to transfer assets
3. Confirms receipt or initiates dispute

**Seller perspective:**

1. Receives payment confirmation
2. Transfers assets to buyer
3. Waits for confirmation or dispute

### Step 4: Completion or Dispute

**If Completed:**

```typescript
await updateEscrowStatus(escrowId, "RELEASED");
await updateOrderStatus(orderId, "COMPLETED");
```

**If Disputed:**

```typescript
const dispute = await createDispute(
  escrowId,
  orderId,
  walletAddress,
  "Payment not received",
  ["evidence"],
);
```

### Step 5: Admin Resolution (If Dispute)

Admin goes to `/p2p/admin-disputes` and:

1. Reviews dispute details
2. Selects resolution type
3. Submits decision

System automatically:

- Updates dispute status to RESOLVED
- Updates escrow status accordingly
- Completes order

---

## Database Structure (KV Keys)

### Orders

```
orders:<orderId> → {P2POrder}
orders:wallet:<walletAddress> → [orderId, orderId, ...]
```

### Escrows

```
escrow:<escrowId> → {Escrow}
escrow:order:<orderId> → [escrowId, ...]
```

### Disputes

```
dispute:<disputeId> → {Dispute}
disputes:all → [disputeId, disputeId, ...]
```

### Payment Methods

```
payment_methods:<methodId> → {PaymentMethod}
payment_methods:wallet:<walletAddress> → [methodId, ...]
```

---

## Environment Setup

### Required Environment Variables

```
STAKING_KV=<your-kv-namespace-binding>
VITE_API_BASE_URL=/api
```

### Cloudflare wrangler.toml

```toml
[[kv_namespaces]]
binding = "STAKING_KV"
id = "your-production-id"
preview_id = "your-preview-id"

[env.development.kv_namespaces]
binding = "STAKING_KV"
id = "your-preview-id"

[env.production.kv_namespaces]
binding = "STAKING_KV"
id = "your-production-id"
```

---

## Testing Checklist

- [ ] Create buy order
- [ ] Create sell order
- [ ] Match orders
- [ ] Create escrow (funds lock)
- [ ] Confirm payment
- [ ] Confirm asset receipt
- [ ] Release escrow
- [ ] Create dispute (test path)
- [ ] Resolve dispute as admin
- [ ] Verify escrow updated correctly
- [ ] Verify polling updates orders in real-time
- [ ] Test 3-second polling interval

---

## Performance Notes

**Polling:**

- 3-second interval: Good balance between latency and server load
- Disable polling when component unmounts
- Consider increasing interval if user volume grows

**Escrow/Disputes:**

- KV operations are fast (< 100ms typical)
- List operations scale with number of items
- Consider pagination for large dispute lists

---

## Future Enhancements

1. **WebSocket Real-time**: Replace polling for true real-time
2. **Blockchain Escrow**: Store funds in Solana program
3. **Auto-resolution**: Resolve disputes after timeout (24h)
4. **Evidence Upload**: Proper file storage for dispute evidence
5. **Multi-sig Escrow**: Require both parties' signature for release
6. **Auction System**: Allow multiple offers on single order
7. **Reputation System**: Track user ratings and completion rates
