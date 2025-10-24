import { RequestHandler } from "express";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Keypair,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { ALCHEMY_RPC_URL } from "../../utils/solanaConfig";

const FXM_MINT = "Ghj3B53xFd3qUw3nywhRFbqAnoTEmLbLPaToM7gABm63";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const LIQUIDITY_WALLET = "Ec72XPYcxYgpRFaNb9b6BHe1XdxtqFjzz2wLRTnx1owA";

const connection = new Connection(ALCHEMY_RPC_URL, "confirmed");

interface SwapRateRequest {
  inputMint: string;
  outputMint: string;
  amount: string;
}

interface SwapRateResponse {
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  outputAmount: string;
  rate: number;
  priceImpact: string;
}

interface SwapExecuteRequest {
  userPublicKey: string;
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  outputAmount: string;
}

interface SwapExecuteResponse {
  transaction: string;
  swapId: string;
  transactionType: "user_transfer" | "liquidity_transfer";
  description: string;
}

// Helper to get or create ATA
const getOrCreateATA = async (
  owner: PublicKey,
  mint: PublicKey,
  instructions: TransactionInstruction[],
): Promise<PublicKey> => {
  const ata = await getAssociatedTokenAddress(owner, mint);

  try {
    const account = await connection.getAccountInfo(ata);
    if (account) return ata;
  } catch {}

  // Create ATA if it doesn't exist
  const createAtaIx = createAssociatedTokenAccountInstruction(
    owner,
    ata,
    owner,
    mint,
  );
  instructions.push(createAtaIx);
  return ata;
};

const getAssociatedTokenAddress = async (
  owner: PublicKey,
  mint: PublicKey,
): Promise<PublicKey> => {
  const seeds = [
    owner.toBuffer(),
    TOKEN_PROGRAM_ID.toBuffer(),
    mint.toBuffer(),
  ];
  const [ata] = PublicKey.findProgramAddressSync(
    seeds,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return ata;
};

const createAssociatedTokenAccountInstruction = (
  payer: PublicKey,
  associatedToken: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
): TransactionInstruction => {
  const data = Buffer.alloc(0);
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: associatedToken, isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: false, isWritable: false },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys,
    data,
  });
};

const transferTokensInstruction = (
  source: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  amount: BigInt,
  decimals: number,
): TransactionInstruction => {
  const data = Buffer.alloc(1 + 8 + 1);
  data[0] = 12; // TransferChecked instruction

  // Write amount as little-endian u64
  for (let i = 0; i < 8; i++) {
    data[1 + i] = Number((amount >> BigInt(i * 8)) & 0xffn);
  }

  data[1 + 8] = decimals;

  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // mint (unused in this context)
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data,
  });
};

// Fixed exchange rate: 1000 FXM = 0.005 SOL
// This means: 1 FXM = 0.000005 SOL, or 1 SOL = 200,000 FXM
const FIXED_FXM_SOL_RATE = 0.000005; // 1 FXM = 0.000005 SOL

// Get the swap rate for FXM<->SOL
export const handleFixoriumSwapRate: RequestHandler = async (req, res) => {
  try {
    // FXM token has been removed and is no longer supported
    return res.status(400).json({
      error: "FXM token is no longer supported",
      message: "FXM swaps are not available",
    });

    // Calculate output amount based on fixed rate
    const inputAmountNum = parseFloat(inputAmount);
    let outputAmount: number;
    let rate: number;

    if (isInputFXM) {
      // FXM -> SOL: 1000 FXM = 0.005 SOL
      outputAmount = inputAmountNum * FIXED_FXM_SOL_RATE;
      rate = FIXED_FXM_SOL_RATE;
    } else {
      // SOL -> FXM: 1 SOL = 200,000 FXM
      outputAmount = inputAmountNum / FIXED_FXM_SOL_RATE;
      rate = 1 / FIXED_FXM_SOL_RATE;
    }

    const response: SwapRateResponse = {
      inputMint: String(inputMint),
      outputMint: String(outputMint),
      inputAmount,
      outputAmount: outputAmount.toString(),
      rate,
      priceImpact: "0.0",
    };

    res.json(response);
  } catch (error) {
    console.error("Fixorium swap rate error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

// Execute FXM<->SOL swap
export const handleFixoriumSwap: RequestHandler = async (req, res) => {
  try {
    // FXM token has been removed and is no longer supported
    return res.status(400).json({
      error: "FXM token is no longer supported",
      message: "FXM swaps are not available",
    });

    // Validate it's FXM<->SOL pair
    if (
      !(
        (isInputFXM && outputMint === SOL_MINT) ||
        (isOutputFXM && inputMint === SOL_MINT)
      )
    ) {
      return res.status(400).json({
        error: "Fixorium swap only supports FXM<->SOL pairs",
      });
    }

    const userPubkey = new PublicKey(userPublicKey);
    const liquidityPubkey = new PublicKey(LIQUIDITY_WALLET);
    const fxmMintPubkey = new PublicKey(FXM_MINT);

    // Generate swap ID
    const swapId = `FXM-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    // Build transaction
    const { blockhash } = await connection.getLatestBlockhash("confirmed");

    const tx = new Transaction({
      recentBlockhash: blockhash,
      feePayer: userPubkey,
    });

    const instructions: TransactionInstruction[] = [];

    if (isInputFXM) {
      // FXM -> SOL: Transfer FXM from user to liquidity wallet
      const userFxmAta = await getAssociatedTokenAddress(
        userPubkey,
        fxmMintPubkey,
      );
      const liquidityFxmAta = await getAssociatedTokenAddress(
        liquidityPubkey,
        fxmMintPubkey,
      );

      // Create liquidity FXM ATA if needed
      try {
        await connection.getAccountInfo(liquidityFxmAta);
      } catch {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            userPubkey,
            liquidityFxmAta,
            liquidityPubkey,
            fxmMintPubkey,
          ),
        );
      }

      // Transfer FXM from user to liquidity
      const inputAmountBigInt = BigInt(
        Math.floor(parseFloat(inputAmount) * 1e6),
      );
      instructions.push(
        transferTokensInstruction(
          userFxmAta,
          liquidityFxmAta,
          userPubkey,
          inputAmountBigInt,
          6,
        ),
      );

      // Note: SOL transfer from liquidity to user is handled off-chain
      // after this transaction is confirmed. The user will receive SOL
      // through a separate transaction signed by the liquidity wallet holder.
    } else {
      // SOL -> FXM: Transfer SOL from user to liquidity wallet
      const userFxmAta = await getAssociatedTokenAddress(
        userPubkey,
        fxmMintPubkey,
      );

      // Create user FXM ATA if needed
      try {
        await connection.getAccountInfo(userFxmAta);
      } catch {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            userPubkey,
            userFxmAta,
            userPubkey,
            fxmMintPubkey,
          ),
        );
      }

      // SOL transfer from user to liquidity
      const solAmountLamports = Math.floor(parseFloat(inputAmount) * 1e9);
      instructions.push(
        SystemProgram.transfer({
          fromPubkey: userPubkey,
          toPubkey: liquidityPubkey,
          lamports: solAmountLamports,
        }),
      );

      // Note: FXM transfer from liquidity to user is handled off-chain
      // after this transaction is confirmed. The user will receive FXM
      // through a separate transaction signed by the liquidity wallet holder.
    }

    // Add memo instruction
    const memoIx = new TransactionInstruction({
      programId: new PublicKey("MemoSq4gDiRvZoYoYo69YxuooQuvKaBLw1SMuV3xs"),
      keys: [],
      data: Buffer.from(`Fixorium Swap FXM↔SOL | SwapID: ${swapId}`, "utf-8"),
    });
    instructions.push(memoIx);

    tx.add(...instructions);

    const serialized = tx.serialize({ requireAllSignatures: false });
    const base64 = serialized.toString("base64");

    const transactionType = isInputFXM ? "user_transfer" : "user_transfer";
    const description = isInputFXM
      ? `Transfer ${inputAmount} FXM to Fixorium liquidity wallet`
      : `Transfer ${inputAmount} SOL to Fixorium liquidity wallet`;

    const response: SwapExecuteResponse = {
      transaction: base64,
      swapId,
      transactionType,
      description,
    };

    res.json(response);
  } catch (error) {
    console.error("Fixorium swap execute error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

// Helper functions to get token prices
async function getFXMPrice(): Promise<number | null> {
  try {
    const response = await fetch(
      "/api/dexscreener/tokens?mint=Ghj3B53xFd3qUw3nywhRFbqAnoTEmLbLPaToM7gABm63",
    );
    if (response.ok) {
      const data = await response.json();
      return data.priceUsd ? parseFloat(data.priceUsd) : null;
    }
  } catch (err) {
    console.warn("Error fetching FXM price from DexScreener:", err);
  }

  // Fallback to Jupiter
  try {
    const response = await fetch(
      `https://price.jup.ag/v4/price?ids=Ghj3B53xFd3qUw3nywhRFbqAnoTEmLbLPaToM7gABm63`,
    );
    if (response.ok) {
      const data = await response.json();
      return (
        data.data?.["Ghj3B53xFd3qUw3nywhRFbqAnoTEmLbLPaToM7gABm63"]?.price ||
        null
      );
    }
  } catch (err) {
    console.warn("Error fetching FXM price from Jupiter:", err);
  }

  return null;
}

async function getSOLPrice(): Promise<number | null> {
  try {
    const response = await fetch(
      "https://price.jup.ag/v4/price?ids=So11111111111111111111111111111111111111112",
    );
    if (response.ok) {
      const data = await response.json();
      return (
        data.data?.["So11111111111111111111111111111111111111112"]?.price ||
        null
      );
    }
  } catch (err) {
    console.warn("Error fetching SOL price:", err);
  }

  return null;
}
