# LabelPress — barcode labels

React UI is built into [`../barcode-backend/public`](../barcode-backend/public) and served by the **same** Node app as the API (cPanel Node). Database stays separate from PetZone POS.

## Develop UI

```bash
# API
cd ../barcode-backend && npm start

# UI with HMR — set VITE_API_URL=http://localhost:5055
npm install && npm run dev
```

## Production build (into barcode-backend/public)

```bash
npm install
npm run build
```

Then start `barcode-backend` only — one URL for UI + API.
