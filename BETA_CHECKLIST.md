# Nair Root — Beta 1 Checklist

Operational checklist to take the product from "code-complete" to "5–10 real testers."
Two repos, one Firebase backend (`nairoot-app`):

- **Android** — `matrimony-app/` (Expo / RN). Holds the Firebase deploy config (`firebase.json`, `firestore.rules`, `firestore.indexes.json`, `functions/`).
- **Website** — `nairoot-web/` (Next.js).

Legend: ⬜ to do · ✅ done · 🔴 blocker.

> ⚠️ **Auth correction (2026-06).** Beta login is now **Firebase Email + Password on both web and
> Android** — phone/OTP is future roadmap only. **Skip every "enable Phone provider / Anonymous
> provider / test phone numbers / SMS billing" item below** — they no longer apply. Premium is
> **coming soon (waitlist), no payments wired**; notifications are **in-app realtime only (no push)**.

---

## 1. Firebase Console configuration
- 🔴 ⬜ **Enable the Phone sign-in provider** (Authentication → Sign-in method → Phone). *Website M6 login does not work until this is on.*
- ⬜ Keep **Anonymous** provider enabled (Android still uses anonymous-first auth).
- 🔴 ⬜ **Authorized domains** (Authentication → Settings → Authorized domains): add the website's production domain + any preview domains (required for reCAPTCHA / Phone Auth on web). `localhost` is allowed by default for local testing.
- ⬜ Confirm the project is **`nairoot-app`** (project # 289843251959) for both clients.
- ⬜ (Optional) Register a dedicated **Web app** to get a web `appId` (today the web reuses the Android `appId` — fine for Auth/Firestore, needed only for web Analytics/Push later).

## 2. Test phone numbers (so QA can log in without real SMS)
- ⬜ Authentication → Sign-in method → Phone → **Phone numbers for testing**: add e.g. `+91 99999 90001` → code `123456` (and a few more for multiple testers).
- ⬜ Share the test numbers + codes with internal QA; real testers use their own phones (real SMS).
- ⬜ Note the **SMS quota / billing**: real OTP SMS requires the Blaze plan; verify billing is enabled if testers use real numbers.

## 3. Cloudinary configuration (photos)
- ⬜ Account/cloud: **`dxee0x4hf`**, unsigned preset: **`bandhan_photos`** (shared by Android + Website).
- 🔴 ⬜ Confirm the preset is **Unsigned** and **allows web-origin uploads** (Settings → Upload → the preset → allowed origins). Without this, website onboarding/profile photo uploads fail.
- ⬜ Confirm folder/`public_id` convention `bandhan/users/{uid}/photos/{index}` is acceptable for production volume.

## 4. Firestore Security Rules
- 🔴 ⬜ **Remove the temporary open `test` rule** before deploying. `matrimony-app/firestore.rules` line ~308:
  ```
  match /test/{docId} { allow read, write: if true; }   // ← DELETE THIS BLOCK
  ```
  It allows anyone to read/write the `test` collection.
- ⬜ Review the `/inviteCodes/{code}` rule (`allow read: if true`) — intentional (pre-auth invite validation); fine if the alpha/invite gate is used, otherwise harmless.
- ⬜ Deploy: `firebase deploy --only firestore:rules` (from `matrimony-app/`).

## 5. Firestore indexes
- ⬜ `matrimony-app/firestore.indexes.json` defines 14 composite indexes (Discover `isVisible+createdAt`, introductions, conversations, messages, notifications, profileViews).
- ⬜ Deploy + confirm **all READY**: `firebase deploy --only firestore:indexes` (a query using equality + orderBy fails with `FAILED_PRECONDITION` until its index is READY).

## 6. Cloud Functions
- ⬜ Only **`onUserDeleted`** exists (auth `onDelete` cleanup). Deploy: `firebase deploy --only functions` (from `matrimony-app/`).
- ⬜ Note: **no Firestore-trigger functions** → the `notifications` collection is not populated (Activity/Notifications are intentionally out of scope for Beta 1).

## 7. Environment variables
**Website (`nairoot-web/.env.local`, and the host's env for deploy):**
- ⬜ `NEXT_PUBLIC_FIREBASE_API_KEY`, `…_AUTH_DOMAIN`, `…_PROJECT_ID`, `…_STORAGE_BUCKET`, `…_MESSAGING_SENDER_ID`, `…_APP_ID`
- ⬜ `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`
- ⬜ `DEV_ADMIN_SECRET` — only if the `/dev/admin` console is kept enabled in prod (see §9); set a strong value, **never** `NEXT_PUBLIC_`.
- ⬜ `.env.local` is gitignored — set these in the host dashboard (e.g. Vercel → Project → Environment Variables).

**Android (`matrimony-app/`):**
- ⬜ `.env` (Firebase + Cloudinary) and `google-services.json` — gitignored; provided via **EAS Secrets / EAS env files** for cloud builds (`GOOGLE_SERVICES_JSON`, `FIREBASE_*`, `CLOUDINARY_*`).
- ⬜ `EXPO_PUBLIC_APP_ENV=production`, decide `EXPO_PUBLIC_ALPHA_MODE` (invite gate — see §8).

## 8. Android release checklist
- 🔴 ⬜ **Build a release/preview APK, not a dev build.** Dev builds (`__DEV__`) show **mock profiles** in Discover and **bypass auth** (mock OTP). Use: `eas build --platform android --profile preview` (or `production`). Testers must install this build.
- ⬜ Decide the **alpha/invite gate** (`EXPO_PUBLIC_ALPHA_MODE`): on → invite-only (distribute invite codes via `inviteCodes`), off → any phone can register.
- ⬜ Confirm `MOCK_AUTH_ENABLED=false` (it is) and real Phone Auth path works on-device (Firebase test numbers or real SMS).
- ⬜ (Recommended, not blocking) Strip logs in release: add `babel-plugin-transform-remove-console` to the production babel env (≈139 `console.*` calls currently ship).
- ⬜ Smoke test the release build on a physical device: onboard → discover → send/accept interest → chat → logout/login.

## 9. Website deployment checklist
- ⬜ Host: Vercel (or equivalent). Framework auto-detected (Next 16). Build: `npm run build`.
- ⬜ Set all env vars from §7 in the host.
- ⬜ Add the production domain to Firebase **Authorized domains** (§1).
- ⬜ **Dev-admin route decision (`/dev/admin`, `/api/dev`):** it is gated by `DEV_ADMIN_SECRET` **and** only functions where the local `firebase-tools` token exists (absent on a host → returns 503, effectively inert). Recommended: gate it behind an env flag that returns 404 in production, **or** simply leave it inert (no token on host) with a strong `DEV_ADMIN_SECRET`. Do not expose it publicly.
- ⬜ Confirm `scripts/` (verify-*, emulator) are **not** shipped (Next bundles `src/` only — they are not).
- ⬜ Smoke test the deployed site: `/login` → OTP → onboarding → discover → interest → chat → `/profile` edit → logout/login.

## 10. Deployment steps (ordered)
1. ⬜ Firebase Console: enable Phone provider, add Authorized domains + test numbers (§1, §2).
2. ⬜ Edit `matrimony-app/firestore.rules` — remove the `test` rule (§4).
3. ⬜ `cd matrimony-app && firebase deploy --only firestore:rules,firestore:indexes,functions`.
4. ⬜ Confirm indexes READY in the console.
5. ⬜ Cloudinary: verify unsigned preset + web origins (§3).
6. ⬜ Website: set env vars → deploy → verify `/login` works end-to-end.
7. ⬜ Android: `eas build --profile preview` → install on test devices → smoke test.
8. ⬜ Seed/keep a small set of starter profiles so testers see a populated Discover (the admin console can create them; the QA seed `scripts/qa-seed.mjs` is one source).
9. ⬜ Invite 5–10 testers (web link + APK).

## 11. Rollback steps
- **Code:** the last green snapshot is the **`RC1`** git tag in both repos (plus the M5/M6 commits on top). To roll back: `git checkout RC1` (or revert the offending commit) and redeploy.
- **Website:** redeploy the previous deployment (Vercel → Deployments → "Promote to Production" on the prior build) — instant rollback.
- **Android:** distribute the previous APK / EAS build (keep the prior `eas build` artifact).
- **Security Rules:** rules are versioned in the Firebase Console (Firestore → Rules → history) — re-publish a prior version, or `firebase deploy --only firestore:rules` from a checkout of the previous rules.
- **Indexes:** additive; rolling back code does not require deleting indexes (safe to leave).
- **Data:** there is no destructive migration in M5/M6 (schema unchanged), so no data rollback is needed. The admin console can delete test data if needed.
