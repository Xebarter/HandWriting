# HandWriting Desktop

Fully offline desktop app for HandWriting. Documents and fonts are stored locally in the browser profile (IndexedDB). No sign-in, no cloud API calls.

## Requirements

- Node.js 20+
- npm

Install dependencies once at the project root and in this folder:

```bash
npm install
cd "Desktop Application"
npm install
```

## Development

From this folder:

```bash
npm install
npm run dev
```

If `npm run dev` fails, the Electron binary probably did not download. Common causes are a blocked/interrupted download or no internet during `npm install`.

Repair it with:

```bash
node scripts/ensure-electron.cjs
npm run dev
```

**Alternatives if Electron dev still fails:**

```bash
# Run the packaged build (after npm run package)
npm run dev:packaged

# Run in the browser without Electron (from project root)
npm run desktop:dev
```

This starts the Next.js dev server in desktop mode on `http://127.0.0.1:3310` and opens it in an Electron window.

You can also run the web UI in desktop mode without Electron:

```bash
npm run desktop:dev
```

(from the project root)

## Brand assets

All logos and icons come from the project `public/` folder:

- In-app logo: `public/favicon.svg`
- Desktop/window/installer icon: `public/favicon.ico`
- PWA manifest icons: `public/web-app-manifest-*.png`

Before dev or packaging, assets are synced into `Desktop Application/build/` for Electron.

## Production build

1. Build the standalone Next.js bundle:

```bash
npm run build:desktop
```

(from the project root)

2. Package the Windows installer:

```bash
npm run build
```

or

```bash
npm run package
```

(from this folder)

The installer is written to `Desktop Application/release/`.

## Offline behavior

When `NEXT_PUBLIC_DESKTOP_APP=1` is set at build time:

- Auth and Supabase session checks are skipped
- Worksheets are saved to IndexedDB instead of `/api/worksheets`
- Fonts are imported and loaded from local IndexedDB only
- Vercel Analytics and cloud session keep-alive are disabled

## Notes

- The desktop app runs a local Next.js server on port **3310**. If that port is in use, stop the other process first.
- For a packaged build, the standalone server is bundled under the app resources folder and started automatically.
