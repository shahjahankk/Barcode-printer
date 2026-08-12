# PetZone LabelPress

One Git folder / one cPanel Node app — same pattern as **Queue Management** and **Laboratory**.

- Startup file: **`server.js`**
- UI lives in committed **`public/`** (no Vite build on cPanel)
- API under `/api/*`
- Static assets under `/api/static/*` (avoids Apache 404s)

## cPanel (git connected)

1. Application root = this repo (`barcode-printer.petzone.pk`)
2. Application startup file = `server.js`
3. Env vars (see `.env.example`). Important:
   - `BARCODE_APP_URL=https://barcode-printer.petzone.pk`
   - Do **not** set `PORT` (cPanel sets it)
4. **Run NPM Install**
5. **Restart** (no `build` step on cPanel)

First-time DB (SSH or once locally against live DB):

```bash
npm run migrate
npm run seed
```

Check: `https://barcode-printer.petzone.pk/api/health`  
Expect `"success": true`, `"database": "up"`, `"files": { "index": true, ... }`

## Local development

```bash
npm install
npm run migrate
npm run seed
npm start                 # API + public UI on :5055
```

UI hot-reload (optional second terminal):

```bash
npm run dev               # Vite; proxies /api → :5055
```

After UI changes, rebuild committed assets:

```bash
npm run build             # writes to public/
```

Then commit `public/` so cPanel stays in sync.
