# Wallet Connection Integration Guide

The Fixorium Wallet now supports external website integration through the `window.fixorium` interface with user approval prompts.

## How It Works

When an external website calls `window.fixorium.connect()`, the wallet will:

1. Detect if the request comes from an external origin (not the wallet itself)
2. Show an acceptance/consent prompt to the user
3. Allow the user to approve or reject the connection
4. Remember trusted origins for future connections

## Usage from External Websites

### Basic Connection

```javascript
// On external website
async function connectWallet() {
  try {
    const result = await window.fixorium.connect();
    console.log('Connected:', result.publicKey.toString());
  } catch (error) {
    console.error('Connection failed:', error.message);
  }
}
```

### Handling Connection Requests

When a user calls `connect()` from an external website:

1. A dialog appears showing:
   - The requesting website's domain
   - The current wallet (if available)
   - Permissions being requested

2. User can:
   - **Approve**: Grants connection and remembers the origin
   - **Reject**: Denies connection and throws an error

### Common Patterns

#### Embed wallet in iframe

```html
<!-- External website -->
<iframe 
  id="wallet-frame" 
  src="https://wallet.fixorium.com.pk">
</iframe>

<script>
  async function connectToWallet() {
    const frame = document.getElementById('wallet-frame');
    const fixorium = frame.contentWindow.fixorium;
    
    try {
      const account = await fixorium.connect();
      console.log('Wallet connected:', account.publicKey.toString());
    } catch (error) {
      console.error('Wallet connection denied');
    }
  }
</script>
```

## Features

### Automatic Origin Detection

The wallet detects external calls by:
- Checking the document referrer
- Detecting iframe context (window.self !== window.top)
- Comparing origins of referrer and current location

### Trusted Origins

Once a user approves a connection from an origin:
- The origin is stored in browser localStorage
- Future connections from that origin require no approval
- Users can clear the data to revoke trust

### Available Methods

After connecting, the wallet provides standard Solana provider methods:

- `signTransaction(transaction)` - Sign a transaction
- `signAllTransactions(transactions)` - Sign multiple transactions
- `signMessage(message)` - Sign a message
- `sendTransaction(transaction)` - Sign and send a transaction
- `disconnect()` - Disconnect the wallet

## Error Handling

```javascript
try {
  const { publicKey } = await window.fixorium.connect();
  
  const transaction = new Transaction();
  // ... add instructions
  
  const signed = await window.fixorium.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signed.serialize());
  
} catch (error) {
  if (error.message.includes('rejected')) {
    console.log('User rejected the connection');
  } else if (error.message.includes('not available')) {
    console.log('Wallet not initialized');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Requirements

- External website must have a wallet set up (create or import)
- External website must be loaded in a browser where Fixorium Wallet is accessible
- CORS headers must allow cross-origin access if needed

## Security Considerations

1. **Origin Verification**: Always verify the user is connecting to a trusted website
2. **User Approval**: Every connection from a new origin requires explicit user consent
3. **Trusted Origins Storage**: Clearing browser data will clear trusted origins
4. **Transaction Review**: Users should always review transaction details before signing

## Testing Locally

1. Set up wallet at `http://localhost:5173`
2. Create or import a wallet
3. Open external website in iframe or new tab
4. Call `window.fixorium.connect()`
5. Dialog should appear for approval
6. After approval, connection is established

## Implementation Details

- Dialog component: `client/components/wallet/ConnectionAcceptanceDialog.tsx`
- Provider implementation: `client/lib/fixorium-provider.ts`
- Integration in App: `client/App.tsx`
- Trusted origins stored in localStorage with key: `fixorium_trusted_origins`
