# Nair Root — Beta Launch Report

**Date:** 2026-06-27 · **Milestone:** Beta Launch Preparation (clear remaining blockers; no new features).
**Backend:** Firebase `nairoot-app` (shared by Android + Website).

## ✅ Recommendation: **GO for Beta — conditional**

All **security and backend blockers are cleared, deployed, and verified**. The product is safe for external testers. The only remaining steps are **deploy actions that require your accounts** (Expo/EAS, the web host, a couple of Firebase Console toggles) — they cannot be performed from this environment. Once those are done (see §7), invite testers.

---

## 1. Deployment status

| Item | Status |
|---|---|
| Firestore **Security Rules** (tightened) | ✅ **Deployed to live `nairoot-app`** |
| Firestore **indexes** | ✅ **Deployed** (14 in file present; 3 extra already in project, left intact) |
| Cloud Functions (`onUserDeleted`) | ◽ Unchanged this milestone (already deployed; no redeploy needed) |
| **Website** production build | ✅ Green (`tsc` + `next build`) — ⏳ **not yet deployed** (needs host) |
| **Android** preview build | ✅ Build-ready — ⏳ **not built** (needs your Expo/EAS login) |

## 2. Security review

| Check | Result |
|---|---|
| Open `test` rule (`allow read, write: if true`) removed | ✅ Removed + **rules redeployed** (compiled clean) |
| App still works under tightened rules | ✅ Full regression re-run (see §6) — 0 regressions |
| `/dev/admin` + `/api/dev` disabled in production | ✅ Gated by `DEV_ADMIN_ENABLED` — **verified 404 in prod-sim, 200 locally** |
| Android dev logs stripped in release | ✅ `babel-plugin-transform-remove-console` (prod env) — **verified strips `log`/`info`, keeps `error`/`warn`** |
| Secrets | ✅ `.env*`, `google-services.json` gitignored; web `src/` has no secrets/logs/TODOs |
| Nothing else still uses `/test` | ✅ Confirmed (only `users` count probe; no `/test` reads/writes) |

## 3. Firebase configuration status (read live via admin API)

| Setting | Status |
|---|---|
| **Phone** sign-in provider | ✅ **Enabled** |
| Anonymous provider (Android) | ✅ Enabled |
| Authorized domains | `localhost`, `nairoot-app.firebaseapp.com`, `nairoot-app.web.app` — ⚠️ **add your production web domain** if not deploying to Firebase Hosting |
| Test phone numbers | ⚠️ **0 configured** — add 1–2 for internal QA without a phone (real testers use real SMS) |
| Real SMS delivery | ⚠️ **Verify Blaze/billing is enabled** (real OTP SMS requires it) |
| Cloudinary unsigned upload (`dxee0x4hf` / `bandhan_photos`) | ✅ **Verified** — real upload returned a `secure_url` |

## 4. Android build information

- **Profile:** `preview` in `eas.json` (internal-distribution APK).
- **Logs:** production builds strip `console.log/info/debug` (kept `error`/`warn`) — `babel.config.js` + `babel-plugin-transform-remove-console` (added to `devDependencies`).
- **Auth/data:** `MOCK_AUTH_ENABLED=false`; a non-dev build uses **real Firestore + real Phone/anon auth** (the dev build's mock data/auth does **not** ship).
- **Build command (run with your Expo login):**
  ```
  cd matrimony-app
  eas build --platform android --profile preview
  ```
- ⏳ **Not executed here** — a cloud build needs your Expo account + consumes EAS quota. The project is build-ready (type-checks clean from a fresh clone per RC1; babel config validated).

## 5. Website deployment status

- **Build:** ✅ green; routes present (`/login`, `/onboarding`, `/discover`, `/profile`, `/introductions`, `/chats`; `/dev/admin` + `/api/dev` dynamic and 404 in prod).
- **Env vars to set on the host** (do **not** set `DEV_ADMIN_ENABLED`):
  `NEXT_PUBLIC_FIREBASE_*` (6), `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`.
- **After deploy:** add the deployed domain to Firebase **Authorized domains** (required for Phone Auth/reCAPTCHA on web).
- ⏳ **Not deployed here** — needs your host account (e.g. Vercel).

## 6. Regression after operational changes (live `nairoot-app`, tightened rules)

| Suite | Result |
|---|---|
| `qa-regression.mjs` (30 cross-platform checks) | ✅ 30 / 30 |
| `verify-phone-auth.mjs` (stable identity, Auth emulator) | ✅ 6 / 6 |
| `verify-onboarding.mjs` (Android-identical profile + interop) | ✅ 5 / 5 |
| `verify-profile-edit.mjs` (rules-safe edits) | ✅ 5 / 5 |
| `verify-cloudinary.mjs` (unsigned upload) | ✅ pass |
| `verify-auth-config.mjs` (provider enabled) | ✅ pass |

## 7. Remaining steps before inviting testers (require your accounts)

1. ⬜ **Deploy the website** (set env vars; do not set `DEV_ADMIN_ENABLED`).
2. ⬜ **Add the deployed web domain** to Firebase → Authentication → Authorized domains.
3. ⬜ **Build the Android preview APK** (`eas build -p android --profile preview`) and distribute the install link.
4. ⬜ **Confirm Blaze/billing** so real OTP SMS sends (testers use their own phones).
5. ⬜ (Optional) Add **test phone numbers** in the Console for internal QA without a device.
6. ⬜ **Seed** a few starter profiles so Discover isn't empty (`scripts/qa-seed.mjs` or the admin console).
7. ⬜ **Commit** the uncommitted changes (tightened `firestore.rules`, `babel.config.js`, dev-route gating, loading polish, beta docs) so the repos match what's deployed.

## 8. Remaining risks

- **Real SMS delivery** is unverified from here (Blaze/billing + carrier). *Mitigation:* test with one real phone before mass-inviting; add Console test numbers as a fallback.
- **Authorized domain** must be added post-deploy or web login fails. *Mitigation:* step 2 above; easy to spot (login throws `auth/unauthorized-domain`).
- **EAS build + website deploy not executed here** — must be run by you. *Mitigation:* commands provided; configs verified build-ready.
- **Dev-admin route** ships in the bundle but is 404 without `DEV_ADMIN_ENABLED` (and inert without the local firebase-tools token). *Mitigation:* keep the flag unset in prod (verified).
- **3 extra Firestore indexes** exist in the project but not the file — harmless (not deleted).

---

## Verdict

> ### 🟢 GO — the product is safe and beta-ready.
> Every blocker that could be fixed in code or deployed from here **has been, and re-verified**: the open `test` rule is gone (rules redeployed), dev routes are 404 in prod, Android logs are stripped in release, Cloudinary and Phone Auth are confirmed, and the full regression passes under the tightened rules. The remaining items are **operational deploy actions on your accounts** (§7). Complete those and Nair Root is ready for 5–10 external testers.
