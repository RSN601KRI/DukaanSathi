# DukaanSaathi AI

Voice-first Hindi/Hinglish assistant for kirana shops.

## Architecture
```text
Mic / audio upload / typed text (browser)
        |
        v
 transcribe() server fn --> Gnani Prisma v2.5 STT  (GNANI_STT_URL, secret key)
        |  (demo mode if not configured -> typed/sample input, clearly labelled)
        v
 parseCommand()  -> { action, product, quantity, customer, amount, missing[] }
        |
 validate -> ask for missing info -> confirmation (Haan / Nahi) for writes
        |
 Signed out: execute() on isolated browser demo state -> demo activity log
 Signed in: shop_operation() -> private Cloud records + atomic activity log
        |
 speak() server fn --> Gnani Timbre v2.5 TTS  (fallback: browser speech, labelled)
```

Stack note: Lovable runs TanStack Start (React + TypeScript + Tailwind) with server
functions instead of FastAPI/SQLite. Live shop data is stored privately in Lovable Cloud.
The public home shows demo records when signed out; signing in switches to the user's
private inventory. New accounts start with the catalogue at zero stock, not fabricated sales.
Email confirmation is required. Google and Lovable sign-in are also available.
Profile edits require confirmation. Sign-out clears private cached records.

## Setup
1. Create an account and confirm your email, or sign in with Google/Lovable.
2. Add stock and confirm Haan, then record a sale. The sale uses the configured unit price.
3. Gnani integration is deferred. The official reference is
   https://docs.gnani.ai/api/introduction/introduction ; current replies use browser speech.
   Microphone recording and audio upload do not transcribe yet.

## Tests
`bunx vitest run src/lib/parser.test.ts src/lib/shop.test.ts src/test/app-routing.test.tsx`
— plus the in-app `/test` page.

## Deploy
Click Publish in Lovable. Secrets stay on the server.

## Demo script
1. Show the dashboard and DEMO banner. 2. Tap "10 kilo chawal aaya" → confirm Haan → chawal stock rises.
3. "2 kilo cheeni becha" → sale total updates. 4. "Ramesh ko 200 rupaye udhaar" → ledger updates.
5. "doodh becha" → app asks for missing quantity. 6. "aaj ka hisaab batao" → spoken summary.
7. Open Test page. 8. Reset demo data.
