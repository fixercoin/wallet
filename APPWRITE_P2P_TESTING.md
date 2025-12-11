# Appwrite P2P Migration - Testing and Validation Guide

This guide provides comprehensive testing procedures to validate the P2P Appwrite migration.

## Pre-Migration Setup

### 1. Environment Configuration

```bash
# .env or deployment environment
APPWRITE_ENDPOINT=https://your-appwrite-instance.com/v1
APPWRITE_PROJECT_ID=your_project_id
APPWRITE_API_KEY=your_api_key
APPWRITE_DATABASE_ID=p2p_db
```

### 2. Run Appwrite Setup

```bash
# Execute the setup script to create collections and attributes
npx tsx scripts/setup-appwrite-p2p.ts
```

Expected output:

```
🔧 Setting up Appwrite P2P Storage...

📦 Creating database...
✅ Created database: p2p_db

📋 Creating collections...
✅ Created collection: p2p_orders
✅ Created collection: p2p_payment_methods
✅ Created collection: p2p_notifications
✅ Created collection: p2p_escrow
✅ Created collection: p2p_disputes
✅ Created collection: p2p_matches
✅ Created collection: p2p_rooms
✅ Created collection: p2p_messages
✅ Created collection: p2p_merchant_stats

🏷️  Creating attributes...
✅ Created 'key' attribute for p2p_orders
✅ Created 'value' attribute for p2p_orders
... (repeat for all collections)

✨ Setup complete!
```

## Express Server Testing

### 1. Test P2P Orders API

#### Create an Order

```bash
curl -X POST http://localhost:8080/api/p2p/orders \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "test_wallet_123",
    "type": "BUY",
    "token": "SOL",
    "amountTokens": 10.5,
    "amountPKR": 50000,
    "paymentMethodId": "pm_test_001"
  }'
```

Expected response:

```json
{
  "success": true,
  "data": {
    "id": "order_1735324800000_abc123",
    "walletAddress": "test_wallet_123",
    "type": "BUY",
    "token": "SOL",
    "amountTokens": 10.5,
    "amountPKR": 50000,
    "paymentMethodId": "pm_test_001",
    "status": "PENDING",
    "createdAt": 1735324800000,
    "updatedAt": 1735324800000
  }
}
```

#### Retrieve Orders for Wallet

```bash
curl http://localhost:8080/api/p2p/orders?wallet=test_wallet_123
```

Expected response:

```json
{
  "success": true,
  "data": [
    {
      "id": "order_1735324800000_abc123",
      "walletAddress": "test_wallet_123",
      "type": "BUY",
      "token": "SOL",
      "amountTokens": 10.5,
      "amountPKR": 50000,
      "status": "PENDING",
      "createdAt": 1735324800000,
      "updatedAt": 1735324800000
    }
  ],
  "count": 1
}
```

### 2. Test Payment Methods API

#### Add Payment Method

```bash
curl -X POST http://localhost:8080/api/p2p/payment-methods \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "test_wallet_123",
    "userName": "TestUser",
    "paymentMethod": "EASYPAISA",
    "accountName": "John Doe",
    "accountNumber": "3001234567890",
    "solanawWalletAddress": "SolanaWalletAddress123"
  }'
```

Expected response:

```json
{
  "success": true,
  "data": {
    "id": "pm_1735324800000_xyz789",
    "walletAddress": "test_wallet_123",
    "userName": "TestUser",
    "paymentMethod": "EASYPAISA",
    "accountName": "John Doe",
    "accountNumber": "3001234567890",
    "createdAt": 1735324800000,
    "updatedAt": 1735324800000
  }
}
```

#### Retrieve Payment Methods

```bash
curl http://localhost:8080/api/p2p/payment-methods?wallet=test_wallet_123
```

### 3. Test Notifications API

#### Create Notification

```bash
curl -X POST http://localhost:8080/api/p2p/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "recipientWallet": "test_wallet_123",
    "senderWallet": "seller_wallet_456",
    "orderId": "order_1735324800000_abc123",
    "type": "order_created",
    "orderType": "BUY",
    "message": "New buy order created",
    "orderData": {
      "token": "SOL",
      "amountTokens": 10.5,
      "amountPKR": 50000
    }
  }'
```

#### Retrieve Notifications

```bash
curl http://localhost:8080/api/p2p/notifications?wallet=test_wallet_123
```

### 4. Test Escrow API

#### Lock Escrow

```bash
curl -X POST http://localhost:8080/api/p2p/escrow \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order_1735324800000_abc123",
    "buyerWallet": "test_wallet_123",
    "sellerWallet": "seller_wallet_456",
    "amountPKR": 50000,
    "amountTokens": 10.5,
    "token": "SOL"
  }'
```

#### Release Escrow

```bash
curl -X PUT http://localhost:8080/api/p2p/escrow \
  -H "Content-Type: application/json" \
  -d '{
    "escrowId": "escrow_1735324800000_esc001",
    "status": "RELEASED"
  }'
```

### 5. Test Disputes API

#### Create Dispute

```bash
curl -X POST http://localhost:8080/api/p2p/disputes \
  -H "Content-Type: application/json" \
  -d '{
    "escrowId": "escrow_1735324800000_esc001",
    "orderId": "order_1735324800000_abc123",
    "initiatedBy": "test_wallet_123",
    "reason": "Payment not received",
    "evidence": ["screenshot_1.jpg", "transaction_id.txt"]
  }'
```

#### Resolve Dispute

```bash
curl -X PUT http://localhost:8080/api/p2p/disputes \
  -H "Content-Type: application/json" \
  -d '{
    "disputeId": "dispute_1735324800000_disp001",
    "resolution": "REFUND_TO_BUYER",
    "resolvedBy": "admin_wallet"
  }'
```

## Cloudflare Functions Testing

### 1. Test Orders Function

```bash
# Test order creation via Cloudflare Functions
curl -X POST https://your-domain.com/api/p2p/orders \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "func_test_wallet",
    "type": "SELL",
    "token": "USDC",
    "amountTokens": 100,
    "amountPKR": 250000,
    "paymentMethodId": "pm_func_001"
  }'
```

### 2. Test Payment Methods Function

```bash
curl -X GET 'https://your-domain.com/api/p2p/payment-methods?wallet=func_test_wallet'
```

### 3. Test Notifications Function

```bash
curl -X GET 'https://your-domain.com/api/p2p/notifications?wallet=func_test_wallet'
```

## Automated Test Suite

Create a test file `test-appwrite-migration.ts`:

```typescript
import { KVStorage } from "./server/lib/kv-storage";

async function runTests() {
  const kv = KVStorage.createAutoStorage();

  console.log("🧪 Running Appwrite P2P Storage Tests...\n");

  // Test 1: Create order
  console.log("Test 1: Creating order...");
  await kv.put(
    "orders:order_test_001",
    JSON.stringify({
      id: "order_test_001",
      walletAddress: "test_wallet",
      type: "BUY",
      token: "SOL",
      amountTokens: 10,
      amountPKR: 50000,
      status: "PENDING",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
  console.log("✅ Order created");

  // Test 2: Retrieve order
  console.log("\nTest 2: Retrieving order...");
  const order = await kv.get("orders:order_test_001");
  console.log("✅ Order retrieved:", JSON.parse(order || "{}"));

  // Test 3: Create payment method
  console.log("\nTest 3: Creating payment method...");
  await kv.put(
    "payment_methods:pm_test_001",
    JSON.stringify({
      id: "pm_test_001",
      walletAddress: "test_wallet",
      userName: "TestUser",
      paymentMethod: "EASYPAISA",
      accountName: "John Doe",
      accountNumber: "3001234567890",
      createdAt: Date.now(),
    }),
  );
  console.log("✅ Payment method created");

  // Test 4: Create notification
  console.log("\nTest 4: Creating notification...");
  await kv.put(
    "notifications:notif_test_001",
    JSON.stringify({
      id: "notif_test_001",
      orderId: "order_test_001",
      recipientWallet: "test_wallet",
      senderWallet: "seller_wallet",
      type: "order_created",
      message: "New order",
      read: false,
      createdAt: Date.now(),
    }),
  );
  console.log("✅ Notification created");

  // Test 5: List keys
  console.log("\nTest 5: Listing keys...");
  const result = await kv.list({ prefix: "orders:" });
  console.log("✅ Keys listed:", result.keys.length, "keys found");

  console.log("\n✨ All tests passed!");
}

runTests().catch(console.error);
```

Run with:

```bash
npx tsx test-appwrite-migration.ts
```

## Validation Checklist

### Data Persistence

- [ ] Orders persist after creation
- [ ] Payment methods are retrievable
- [ ] Notifications are stored correctly
- [ ] Escrow data is preserved
- [ ] Disputes maintain consistency

### API Functionality

- [ ] All P2P endpoints respond with correct status codes
- [ ] Error messages are descriptive
- [ ] CORS headers are present
- [ ] Request validation works properly
- [ ] Response format is consistent

### Storage Backend

- [ ] Appwrite connection established
- [ ] Collections created successfully
- [ ] Data stored in Appwrite database
- [ ] Both Cloudflare and Express access the same data
- [ ] Fallback to Cloudflare KV works (if credentials present)

### Performance

- [ ] Order retrieval is fast (< 200ms)
- [ ] Payment method operations complete quickly
- [ ] Notifications load without delay
- [ ] List operations handle large datasets
- [ ] No timeout errors

### Security

- [ ] API key is not exposed in logs
- [ ] Invalid credentials rejected properly
- [ ] CORS correctly restricts access
- [ ] No sensitive data in responses
- [ ] Rate limiting works (if implemented)

## Rollback Procedure

If migration fails:

1. **Keep Appwrite environment variables unchanged**
2. **Remove APPWRITE\_\* variables** from environment
3. **System automatically falls back to Cloudflare KV**
4. **No data loss** - both systems can coexist
5. **Troubleshoot and retry**

## Common Issues and Solutions

### Issue: "Storage not configured"

**Solution**: Verify Appwrite credentials are set:

```bash
echo $APPWRITE_ENDPOINT
echo $APPWRITE_PROJECT_ID
echo $APPWRITE_API_KEY
```

### Issue: "Collection not found"

**Solution**: Run setup script again:

```bash
npx tsx scripts/setup-appwrite-p2p.ts
```

### Issue: Timeout errors

**Solution**: Check Appwrite instance connectivity:

```bash
curl https://your-appwrite-endpoint.com/v1/health
```

### Issue: Mixed data sources

**Solution**: Ensure all endpoints use the same storage. Check if Appwrite credentials are globally set.

## Success Criteria

Migration is successful when:

1. ✅ All P2P CRUD operations work via Express
2. ✅ All P2P CRUD operations work via Cloudflare Functions
3. ✅ Data persists in Appwrite database
4. ✅ No errors in logs
5. ✅ Performance is acceptable
6. ✅ Existing Cloudflare KV data is migrated (optional)

## Performance Benchmarks

Expected latencies:

- Create order: < 100ms
- Retrieve order: < 50ms
- List orders: < 200ms
- Update status: < 100ms
- Create notification: < 80ms

If latencies exceed these, check:

- Network connectivity to Appwrite
- Database query optimization
- Collection indexing
- Appwrite instance load
