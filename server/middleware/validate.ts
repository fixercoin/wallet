import { Request, Response, NextFunction } from "express";

export function validateSwapRequest(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const body = req.body || {};
  // Accept either Meteora/Jupiter style (inputMint + outputMint + amount)
  const hasInputOutput =
    !!body.inputMint &&
    !!body.outputMint &&
    body.amount !== undefined &&
    body.amount !== null;
  // Or Pumpfun style (mint + amount)
  const hasMintAmount =
    !!body.mint && body.amount !== undefined && body.amount !== null;

  if (!hasInputOutput && !hasMintAmount) {
    return res
      .status(400)
      .json({
        error:
          "Missing required fields. Provide either inputMint+outputMint+amount or mint+amount",
      });
  }

  // Basic type checks
  if (hasInputOutput) {
    if (
      typeof body.inputMint !== "string" ||
      typeof body.outputMint !== "string"
    )
      return res.status(400).json({ error: "Invalid mint types" });
    if (isNaN(Number(body.amount)))
      return res.status(400).json({ error: "Invalid amount" });
  }
  if (hasMintAmount) {
    if (typeof body.mint !== "string")
      return res.status(400).json({ error: "Invalid mint" });
    if (isNaN(Number(body.amount)))
      return res.status(400).json({ error: "Invalid amount" });
  }

  // limit maximum amount for safety in proxied requests (prevent accidental huge calls)
  const amt = Number(body.amount);
  if (amt > 1e9) return res.status(400).json({ error: "Amount too large" });

  return next();
}

export function validateSolanaSend(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const b = req.body || {};
  const tx =
    b.signedBase64 ||
    b.signedTx ||
    b.tx ||
    b.signedTransaction ||
    b.serializedTx ||
    b.serializedTransaction;
  if (!tx || typeof tx !== "string")
    return res
      .status(400)
      .json({ error: "Missing signed transaction (base64)" });
  // basic length check
  if (tx.length < 16)
    return res.status(400).json({ error: "signed transaction too short" });
  return next();
}

export function validateSwapSubmit(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const b = req.body || {};
  const tx = b.signedTx || b.signedBase64 || b.tx || b.signedTransaction;
  if (!tx || typeof tx !== "string")
    return res
      .status(400)
      .json({ error: "Missing 'signedTx' field (base64 transaction)" });
  if (tx.length < 16)
    return res.status(400).json({ error: "signedTx too short" });
  return next();
}
