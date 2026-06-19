# Limelight — Theatre Log

A theatre log of West End shows seen, kept as draggable ticket stubs on a
curtained stage. Built with **Next.js** (App Router, server API routes) and the
paper-cut "Limelight" UI from the Claude Design source.

## Stack

- **Next.js 16** (App Router) — SSR page + serverless API routes (the backend).
- **React 19** — interactive client UI (`components/TheatreLog.tsx`): the
  cursor-reactive curtains, draggable ticket stubs, and live search overlay.

## Architecture

```text
app/
  layout.tsx          fonts (Bodoni Moda + Spline Sans Mono) + metadata
  page.tsx            server component → reads lib/shows → renders <TheatreLog/>
  globals.css         extracted styles
  api/
    shows/route.ts    GET /api/shows         → full repertoire
    search/route.ts   GET /api/search?q=…    → filtered results
components/
  TheatreLog.tsx      client UI: curtains, draggable stubs, live search
lib/
  shows.ts            data layer (single source of truth; swap for a DB later)
```

The search overlay calls `GET /api/search` live, so the frontend is wired to the
backend rather than filtering a hardcoded array in the browser.

## Develop

```sh
npm install
npm run dev      # http://localhost:3000
```

## Build & run production

```sh
npm run build
npm run start
```

## Deploy (Vercel)

This app uses server API routes, so it runs on a Node host (not static GitHub
Pages). Deploy on Vercel:

1. Push to GitHub (done — `kweeyo09/ghostlight`).
2. Import the repo at <https://vercel.com/new> — Vercel auto-detects Next.js;
   no config needed. Every push to `main` then redeploys automatically.

Or, with the Vercel CLI: `npm i -g vercel && vercel --prod`.

## Source

The visual design originates from a Claude Design project ("theatre web"),
authored in Claude Design's `.dc.html` runtime format. The original component is
preserved at [`Theatre Log.dc.html`](Theatre%20Log.dc.html); this repo is a
framework-ready implementation of it.
