# LabelPress (UI + API in this folder)

One Git repo / one cPanel Node app. Startup file: **`server.js`**.

## cPanel (git connected)

1. Application root = this repo folder (`barcode-printer.petzone.pk`)
2. Startup file = `server.js`
3. Add env vars (same as `.env.example`, live `BARCODE_APP_URL=https://barcode-printer.petzone.pk`)
4. **Run NPM Install**
5. **Run JS script → `build`**
6. **Restart**

Check: `https://barcode-printer.petzone.pk/api/health`

## Local

```bash
npm install
npm run migrate   # first time only
npm run seed      # first time only
npm start         # API + built UI on :5055
```

UI with HMR (separate terminal): `npm run dev` (proxies `/api` to :5055).
