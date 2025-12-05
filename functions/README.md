# Cloudflare Pages Functions

This folder contains the legacy function definitions. They have been moved to `netlify/functions/` for Cloudflare Pages serverless deployment.

The main API handler is at `netlify/functions/api.ts` which is a comprehensive Cloudflare Pages serverless function that handles all API routes.

## For Cloudflare Pages Deployment

All serverless functions are now in the `netlify/functions/` directory:

- `netlify/functions/api.ts` - Main API handler that routes all `/api/*` requests
- `netlify/functions/api/pumpfun/*` - Pump.fun specific routes

When deploying to Cloudflare Pages, the functions will automatically be deployed from the `netlify/functions/` directory.

## Local Development

For local development, the Express server (`server/index.ts`) handles all API requests on port 3000 during development.

To run locally:

```bash
npm run dev
```

This starts both:

- Frontend on http://localhost:5173
- Backend API on http://localhost:3000
