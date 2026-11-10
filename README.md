# DukaanSaathi AI

A Hindi/Hinglish voice-first shop assistant for small grocery shops. It can transcribe microphone recordings, turn spoken or typed commands into inventory, sales, and credit entries, ask for confirmation before saving, and read responses aloud.

## Features

- Hindi/Hinglish command parsing with typed and sample-command alternatives.
- Microphone recordings converted to WAV in the browser before Gnani speech-to-text requests.
- Gnani text-to-speech playback with a browser speech fallback.
- Confirmation before business changes; sales use the product's configured price and cannot exceed available stock.
- Isolated demo records when signed out and account-scoped shop records when signed in.
- Clerk sign-in and profile controls; database-backed shop operations.

## Technology

- TanStack Start, React, TypeScript, and Tailwind CSS.
- Clerk for sign-in.
- The existing Postgres-compatible backend for shop profiles, inventory, sales, credits, and activity records.
- Gnani AI for speech-to-text and text-to-speech.
- Nitro's Vercel preset for server-side deployment.

## Run locally

Requirements: [Bun](https://bun.sh/) and Node.js 20 or newer.

```sh
git clone https://github.com/RSN601KRI/DukaanSathi.git
cd DukaanSathi
bun install
cp .env.example .env
# Leave credentials blank for the browser-only public demo. Configure Clerk and
# Supabase values in .env to enable sign-in and private shop records.
bun run dev
```

Without Clerk and Supabase credentials, the home page runs in demo mode and
keeps sample records in the browser only. Sign-in, private shop records, and
Gnani voice transcription require their respective credentials in `.env`.

Run checks:

```sh
bun run test
bun run build
```

## Environment variables

Copy `.env.example` for local work. For Vercel, add these values in the project's environment-variable settings instead; never commit `.env` or place private credentials in browser-prefixed variables.

| Variable | Purpose | Private? |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Browser database endpoint | No |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser database publishable key | No |
| `SUPABASE_URL` | Server database endpoint | No |
| `SUPABASE_PUBLISHABLE_KEY` | Server auth middleware publishable key | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only shop database operations | **Yes** |
| `CLERK_PUBLISHABLE_KEY` | Clerk sign-in setup | No |
| `CLERK_SECRET_KEY` | Clerk server authentication | **Yes** |
| `GNANI_API_KEY` | Gnani STT/TTS authentication | **Yes** |
| `GNANI_STT_URL` | Gnani speech-to-text endpoint | No |
| `GNANI_TTS_URL` | Gnani text-to-speech endpoint | No |

The Gnani endpoints default to the documented Vachana STT and TTS URLs, so `GNANI_API_KEY` is the only required Gnani setting. Optional settings are `GNANI_AUTH_HEADER` (defaults to `X-API-Key-ID`), `GNANI_AUTH_PREFIX` (defaults to empty), and `GNANI_TTS_VOICE`. Leave `GNANI_TTS_VOICE` empty to select Nalini for Hindi, Poorvi for Hinglish, or Kaveri for English. Use the “Gnani TTS test karein” button in the app to verify a live synthesized clip and playback.

The `SUPABASE_SERVICE_ROLE_KEY`, `CLERK_SECRET_KEY`, and `GNANI_API_KEY` must remain server-only. Do not prefix them with `VITE_`, publish them in a GitHub repository, or expose them in browser code. Values stored in Lovable are not automatically copied to Vercel.

Lovable project secrets are available to the hosted app's server runtime, not to a local `bun run dev` process. The server reads request-scoped runtime bindings when present and falls back to `process.env`, which is the supported Vercel environment-variable interface. Configure `GNANI_API_KEY`, `GNANI_STT_URL`, and `GNANI_TTS_URL` in the Vercel project's server-side environment settings separately; the Vercel Nitro preset is selected for production builds.

## Deploy to Vercel

1. Upload or push this source to a GitHub repository, then import that repository into Vercel.
2. Configure the environment variables above for each Vercel environment you use. Add Clerk's Vercel domain to the Clerk application's allowed domains and configure its sign-in redirects.
3. Apply the SQL migrations in `drizzle/migrations/` to the database project used by the app, in numerical order, before testing signed-in shop records. The migrations create the shop tables and the Clerk-to-profile operations used by the server.
4. Deploy over HTTPS. Microphone access requires a secure origin; Vercel provides HTTPS for deployed sites.

Vercel hosts the web app; it does not move the existing database, user accounts, or stored secrets. This source currently expects the database API and SQL functions represented by the included migrations. To stop using Lovable Cloud entirely, first configure a compatible database project and migrate any records and accounts you need; the archive does not transfer backend data or credentials.

## Gnani API

Gnani requests run through server functions, so the API key is not sent to the browser. The client converts microphone recordings to 16 kHz mono WAV before transcription. If Gnani is not configured or an API request fails, the UI reports the error and keeps typed-command entry available; it does not simulate a successful transcript.

Official reference: <https://docs.gnani.ai/api/introduction/introduction>

## Repository notes

- `.env.example` contains variable names and non-secret defaults only.
- `drizzle/migrations/` contains the shop database schema and SQL operations. Keep the database project and its credentials configured separately from this source repository.
- Do not commit `node_modules/`, build output, `.env`, or repository-specific Git metadata.