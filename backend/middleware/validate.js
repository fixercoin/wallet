export function validateSwapRequest(req, res, next) {
  const body = req.body || {};
  const hasInputOutput =
    !!body.inputMint &&
    !!body.outputMint &&
    body.amount !== undefined &&
    body.amount !== null;
  const hasMintAmount =
    !!body.mint && body.amount !== undefined && body.amount !== null;

  if (!hasInputOutput && !hasMintAmount) {
    return res.status(400).json({
      error:
        "Missing required fields. Provide either inputMint+outputMint+amount or mint+amount",
    });
  }

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

  const amt = Number(body.amount);
  if (amt > 1e9) return res.status(400).json({ error: "Amount too large" });

  return next();
}

export function validateSolanaSend(req, res, next) {
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
  if (tx.length < 16)
    return res.status(400).json({ error: "signed transaction too short" });
  return next();
}

export function validateSwapSubmit(req, res, next) {
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
