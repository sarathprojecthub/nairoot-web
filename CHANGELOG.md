# Changelog — The Nair Root (Website)

A Nair-community introductions platform with two clients (Android + Website) on one
Firebase backend (`nairoot-app`). This log covers the website (`nairoot-web`);
Android lives in `matrimony-app`. Dates are milestone completions.

## Unreleased — Beta Launch Prep (2026-06-27)
### Security
- **Removed the open `/test` Firestore rule** (`allow read, write: if true`) and **redeployed** rules + indexes to live `nairoot-app`. Nothing in either client used `/test`.
- **Gated developer-only routes for production:** `/dev/admin` and `/api/dev` respond **404** unless `DEV_ADMIN_ENABLED=true` (set locally, absent on production hosts). Verified in both states.
- **Android release builds strip `console.log/info/debug`** (keep `error`/`warn`) via `babel-plugin-transform-remove-console` (production babel env).
### Verified
- Full regression green under the tightened rules: cross-platform 30/30, phone-auth identity 6/6, onboarding 5/5, profile-edit 5/5.
- Cloudinary unsigned upload confirmed; Firebase **Phone Auth provider confirmed enabled**.
### Docs
- Added `BETA_CHECKLIST.md`, `BETA_READINESS_REPORT.md`, `BETA_LAUNCH_REPORT.md` (GO — conditional on deploy actions).
- Added verification scripts: `verify-cloudinary.mjs`, `verify-auth-config.mjs`, `verify-phone-auth.mjs` (Auth-emulator).

## M6 — Production Authentication & Account Identity (2026-06-26)
- Replaced anonymous-first auth with **Firebase Phone OTP** (`signInWithPhoneNumber` + invisible reCAPTCHA). A phone maps to a **stable uid**, so a returning member reconnects to the same profile across browsers/devices.
- **Persistent session** (IndexedDB) + **require-login** access model (no anonymous browsing). `AuthProvider` + `RequireAuth` guards; `/login`; logout/login.
- Migrated all anonymous-only code off `signInAnonymously` (one `ensureAuth` chokepoint + hooks + onboarding). **No Firestore schema/rule changes** — interop with Android preserved. See `MIGRATION_M6.md`.
- UX: unified loading states (`components/ui/Loading.tsx`), accessible progress bar, fixed page metadata title.

## M5 — Onboarding & Profile Editing (2026-06-26)
- Web-native **6-step onboarding wizard** (regrouped from the Android per-screen flow), reusing the ported `lib/onboarding/*` business logic — Android-identical `users/{uid}` + `profiles/{uid}` writes.
- **Profile editing** (`/profile`): fields, photos, visibility toggle (rules-safe).
- Cloudinary photo upload (same account/preset as Android).

## RC1 — Release Candidate (QA-validated)
- Internal **dev-admin console** (P1) for test-data management (server-only, rules-bypassing via the local firebase-tools token).
- Full QA regression: 30/30 across Android↔Android, Android↔Website, Website↔Website. Tagged **`RC1`** (rollback point).

## M1–M4 — Core flows
- **M1** Discover (responsive grid + detail). **M2** Send Interest (`introductions`, dedupe). **M3** Introductions & Accept (atomic conversation + match). **M4** Chats (realtime, cross-platform).

## M0 — Scaffold
- Next.js + Tailwind + Firebase JS SDK; connected to `nairoot-app`.
