# LabelPress — Barcode Label Generator

Barcode label generator (Code128 / EAN-13 / UPC-A) with live preview, batch, PNG/ZIP download, and print.

Persistence is via the **separate** [`barcode-backend`](../barcode-backend) API + MySQL database (not the POS backend).

## Local development

1. Start API (see [`../barcode-backend/README.md`](../barcode-backend/README.md)).
2. Copy `.env.example` → `.env` and set `VITE_API_URL`.
3. `npm install && npm run dev`

## Build / cPanel static host

```bash
VITE_API_URL=https://barcode-api.yourdomain.com npm run build
```

Upload `dist/` to `barcode.yourdomain.com`.

## POS integration

Open from Admin / Warehouse menu. POS mints a short-lived SSO token; this app exchanges it at `/?sso=...`.
