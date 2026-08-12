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
4. Install **production** packages only (UI is already in `public/` — do not install Vite/TypeScript on cPanel):

```bash
source /home/petzonep/nodevenv/barcode-printer.petzone.pk/20/bin/activate
cd /home/petzonep/barcode-printer.petzone.pk

# If you hit ENOTEMPTY (stuck typescript rename), clean then reinstall:
rm -rf node_modules
rm -rf /home/petzonep/nodevenv/barcode-printer.petzone.pk/20/lib/node_modules/typescript
rm -rf /home/petzonep/nodevenv/barcode-printer.petzone.pk/20/lib/node_modules/.typescript-*
rm -rf /home/petzonep/nodevenv/barcode-printer.petzone.pk/20/lib/node_modules/vite
rm -rf /home/petzonep/nodevenv/barcode-printer.petzone.pk/20/lib/node_modules/.vite-*

NODE_ENV=production npm install --omit=dev
```

5. **Restart** the Node app (no `build` step on cPanel)

First-time DB (SSH or once locally against live DB):

```bash
npm run migrate
npm run seed
```

## Important (cPanel blank page)

Do **not** put Vite `index.html` in the app root. Apache will serve `/src/main.tsx` and the page stays blank.
Dev entry is `app.html`; production UI is only `public/index.html` (served by Node).

After pull on the server, if an old root `index.html` still exists:

```bash
rm -f /home/petzonep/barcode-printer.petzone.pk/index.html
```

Then Restart the Node app.

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
