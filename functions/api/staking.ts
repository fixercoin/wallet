import nacl from "tweetnacl";
import bs58 from "bs58";

interface StakeRecord {
  id: string;
  walletAddress: string;
  tokenMint: string;
  amount: number;
  stakePeriodDays: number;
  startTime: number;
  endTime: number;
  rewardAmount: number;
  status: "active" | "completed" | "withdrawn";
  withdrawnAt?: number;
  createdAt: number;
}

interface StakingStore {
  stakes: Map<string, StakeRecord>;
}

// In-memory store (persists during execution)
const store: StakingStore = {
  stakes: new Map(),
};

// Helper functions
function applyCors(headers: Headers) {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );
  headers.set("Vary", "Origin");
  return headers;
}

function jsonCors(status: number, body: any) {
  const headers = applyCors(
    new Headers({ "Content-Type": "application/json" }),
  );
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers,
  });
}

function generateStakeId(): string {
  return `stake_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function calculateReward(amount: number, periodDays: number): number {
  // 10% APY
  const yearlyReward = amount * 0.1;
  const dailyRate = yearlyReward / 365;
  return dailyRate * periodDays;
}

function verifySignature(
  message: string,
  signature: string,
  publicKeyStr: string,
): boolean {
  try {
    const sig = bs58.decode(signature);
    const msg = new TextEncoder().encode(message);
    const pubKeyBytes = bs58.decode(publicKeyStr);
    return nacl.sign.detached.verify(msg, sig, pubKeyBytes);
  } catch {
    return false;
  }
}

export const onRequestGet = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const action = url.pathname.split("/").pop();

  if (action === "config") {
    return jsonCors(200, {
      success: true,
      data: {
        vaultWallet: "FNVD1wied3e8WMuWs34KSamrCpughCMTjoXUE1ZXa6wM",
        apyPercentage: 10,
        supportedPeriods: [30, 60, 90],
        rewardTokenMint: "FxmrDJB16th5FeZ3RBwAScwxt6iGz5pmpKGisTJQcWMf",
      },
    });
  }

  const walletAddress = url.searchParams.get("wallet");
  const authMessage = url.searchParams.get("message");
  const authSignature = url.searchParams.get("signature");

  if (!walletAddress || !authMessage || !authSignature) {
    return jsonCors(400, { error: "Missing wallet, message, or signature" });
  }

  if (!verifySignature(authMessage, authSignature, walletAddress)) {
    return jsonCors(401, { error: "Invalid signature" });
  }

  const stakes = Array.from(store.stakes.values()).filter(
    (stake) => stake.walletAddress === walletAddress,
  );

  return jsonCors(200, {
    stakes: stakes.map((stake) => ({
      ...stake,
      timeRemainingMs:
        stake.status === "active" ? Math.max(0, stake.endTime - Date.now()) : 0,
    })),
  });
};

export const onRequestPost = async ({ request }: { request: Request }) => {
  const body = await request.json().catch(() => ({}));

  const action = body.action;
  const walletAddress = String(body.wallet || "").trim();
  const authMessage = String(body.message || "");
  const authSignature = String(body.signature || "");

  if (!walletAddress || !authMessage || !authSignature) {
    return jsonCors(400, { error: "Missing wallet, message, or signature" });
  }

  if (!verifySignature(authMessage, authSignature, walletAddress)) {
    return jsonCors(401, { error: "Invalid signature" });
  }

  if (action === "create") {
    const tokenMint = String(body.tokenMint || "").trim();
    const amount = Number(body.amount);
    const periodDays = Number(body.periodDays);

    if (!tokenMint || !amount || amount <= 0 || !periodDays) {
      return jsonCors(400, {
        error: "Invalid tokenMint, amount, or periodDays",
      });
    }

    const validPeriods = [
      10 / (24 * 60), // 10 minutes
      10, // 10 days
      30, // 30 days
      60, // 60 days
      90, // 90 days
    ];
    if (!validPeriods.some((p) => Math.abs(p - periodDays) < 0.0001)) {
      return jsonCors(400, {
        error:
          "Invalid period. Must be 10 minutes, 10 days, 30 days, 60 days, or 90 days",
      });
    }

    const stakeId = generateStakeId();
    const now = Date.now();
    const endTime = now + periodDays * 24 * 60 * 60 * 1000;
    const rewardAmount = calculateReward(amount, periodDays);

    const stake: StakeRecord = {
      id: stakeId,
      walletAddress,
      tokenMint,
      amount,
      stakePeriodDays: periodDays,
      startTime: now,
      endTime,
      rewardAmount,
      status: "active",
      createdAt: now,
    };

    store.stakes.set(stakeId, stake);

    return jsonCors(200, {
      success: true,
      stake: {
        ...stake,
        timeRemainingMs: periodDays * 24 * 60 * 60 * 1000,
      },
    });
  } else if (action === "withdraw") {
    const stakeId = String(body.stakeId || "").trim();
    const stake = store.stakes.get(stakeId);

    if (!stake) {
      return jsonCors(404, { error: "Stake not found" });
    }

    if (stake.walletAddress !== walletAddress) {
      return jsonCors(403, { error: "Unauthorized" });
    }

    if (stake.status !== "active") {
      return jsonCors(400, {
        error: "Stake is not active",
      });
    }

    const now = Date.now();
    if (now < stake.endTime) {
      return jsonCors(400, {
        error: "Staking period has not ended yet",
      });
    }

    // Backend handles vault signing and transaction sending
    // In production, the vault private key would be retrieved from Cloudflare Environment Variables
    const vaultPrivateKeyBase58 = (process.env as any).VAULT_PRIVATE_KEY;

    if (!vaultPrivateKeyBase58) {
      return jsonCors(500, {
        error: "Vault private key not configured",
      });
    }

    try {
      // Decode vault private key
      const vaultPrivateKey = bs58.decode(vaultPrivateKeyBase58);

      // In production, this would:
      // 1. Build the transfer transaction (vault → user with amount + reward)
      // 2. Sign the transaction with the vault private key
      // 3. Submit to the Solana blockchain
      // 4. Wait for confirmation
      // 5. Return the transaction hash

      const totalAmount = stake.amount + stake.rewardAmount;

      stake.status = "withdrawn";
      stake.withdrawnAt = now;

      return jsonCors(200, {
        success: true,
        data: {
          stake,
          totalAmount,
          reward: {
            amount: stake.rewardAmount,
            tokenMint: stake.tokenMint,
            payerWallet: "FNVD1wied3e8WMuWs34KSamrCpughCMTjoXUE1ZXa6wM",
            recipientWallet: walletAddress,
            status: "processing",
            note: "Withdrawal is being processed by the backend vault",
          },
        },
      });
    } catch (vaultError) {
      return jsonCors(500, {
        error: "Failed to process withdrawal with vault",
      });
    }
  } else {
    return jsonCors(400, { error: "Invalid action" });
  }
};

export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: applyCors(new Headers()) });
};
