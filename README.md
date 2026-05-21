# Reel Ready

An AI-powered storyboard builder for Instagram Reels and other short-form video.

Reel Ready helps you turn a library of raw clips and reusable phrases into
finished, ready-to-post reels. You upload videos, let AI analyze and segment
them, match clips to your captions/phrases, assemble a storyboard, render the
final video with burned-in text overlays, and track how it performs once posted.

## Features

- **Video library** — upload clips and have them auto-analyzed and segmented by AI (Google Gemini).
- **Phrases** — manage a reusable library of hooks/captions, with AI suggestions.
- **AI matching** — suggest which clips fit which phrases, plus deep matching across your library.
- **Reel builder** — drag-and-drop storyboard, clone existing reels, and generate trial variants in batches.
- **Templates** — analyze a reference reel and reuse its structure as a template.
- **Trending audio** — research and add trending audio for your reels.
- **Export** — render reels server-side with FFmpeg, including text overlays burned into the video.
- **Instagram integration** — OAuth connect and sync of post metrics.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Vite, React 18, TypeScript |
| UI | shadcn/ui (Radix), Tailwind CSS |
| Data/state | TanStack Query, React Router |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) |
| AI | Google Gemini (via Supabase Edge Functions) |
| Object storage | Cloudflare R2 |
| Video rendering | Node/Express + FFmpeg worker (deployed on Fly.io) |

## Architecture

The repo has three pieces:

- **`src/`** — the React single-page app (this is what you run locally with `npm run dev`).
- **`supabase/`** — database migrations and ~20 Edge Functions that handle AI
  analysis, matching, suggestions, exports, and Instagram sync.
- **`worker/`** — a standalone Express service that does the heavy video work
  (FFmpeg export + thumbnail generation). It's containerized and deployed to Fly.io.

## Running locally

### Prerequisites

- [Node.js](https://nodejs.org) 18+ and npm (install via [nvm](https://github.com/nvm-sh/nvm) if you like)
- A [Supabase](https://supabase.com) project (for the database, auth, and Edge Functions)
- Optional, for full functionality: a [Google Gemini](https://ai.google.dev) API key,
  a [Cloudflare R2](https://developers.cloudflare.com/r2/) bucket, and the worker
  running locally or on Fly.io

### 1. Clone and install

```sh
git clone https://github.com/michelleroamswild/reel-ready.git
cd reel-ready
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your Supabase project values:

```sh
cp .env.example .env
```

```sh
# .env (frontend)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

The remaining secrets (Gemini, Cloudflare R2) are **not** exposed to the client —
set them as Supabase Edge Function secrets instead:

```sh
supabase secrets set GEMINI_API_KEY=xxx
supabase secrets set R2_ACCOUNT_ID=xxx R2_ACCESS_KEY_ID=xxx R2_SECRET_ACCESS_KEY=xxx \
  R2_BUCKET_NAME=xxx R2_PUBLIC_URL=https://your-bucket.your-domain.com
```

### 3. Set up the database

Apply the migrations in `supabase/migrations/` to your Supabase project (e.g. via
the [Supabase CLI](https://supabase.com/docs/guides/cli)):

```sh
supabase link --project-ref your-project-ref
supabase db push
```

### 4. Start the dev server

```sh
npm run dev
```

The app runs at [http://localhost:8080](http://localhost:8080).

### 5. (Optional) Deploy Edge Functions

To exercise AI analysis, matching, exports, and Instagram sync, deploy the
functions in `supabase/functions/`:

```sh
supabase functions deploy
```

### 6. (Optional) Run the video worker

The export/thumbnail worker lives in `worker/` and needs FFmpeg available.

```sh
cd worker
npm install
npm start   # serves on port 8080 by default
```

For production it's built from `worker/Dockerfile` and deployed with Fly.io
(`fly deploy` from the `worker/` directory, see `worker/fly.toml`).

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run build:dev` | Development-mode build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run the test suite (Vitest) |
| `npm run test:watch` | Run tests in watch mode |

## Deployment

The frontend is a static SPA and can be deployed to any static host (e.g. Vercel —
see `vercel.json` for the SPA rewrite). The backend runs on Supabase, and the
video worker runs on Fly.io.
