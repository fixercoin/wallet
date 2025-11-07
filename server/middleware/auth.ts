import { Request, Response, NextFunction } from "express";

// Simple API key auth middleware.
// If FIXORIUM_API_KEY is set in env, incoming requests must provide it via:
// - Authorization: Bearer <key> OR
// - x-api-key: <key>

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const configured = process.env.FIXORIUM_API_KEY;
  if (!configured) return next(); // no API key configured => allow

  const authHeader = req.headers.authorization;
  let provided: string | null = null;
  if (authHeader && typeof authHeader === "string") {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer")
      provided = parts[1];
  }
  if (!provided) provided = (req.headers["x-api-key"] as string) || null;

  if (!provided || provided !== configured) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}
