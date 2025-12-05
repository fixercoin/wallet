export function requireApiKey(req, res, next) {
  const configured = process.env.FIXORIUM_API_KEY;
  if (!configured) return next();

  const authHeader = req.headers.authorization;
  let provided = null;
  if (authHeader && typeof authHeader === "string") {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer")
      provided = parts[1];
  }
  if (!provided) provided = req.headers["x-api-key"] || null;

  if (!provided || provided !== configured) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}
