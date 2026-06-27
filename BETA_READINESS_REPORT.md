# Nair Root — Beta 1 Readiness Report

**Date:** 2026-06-27 · **Scope:** Android (`matrimony-app`) + Website (`nairoot-web`), shared Firebase `nairoot-app`.
**Goal:** confirm the product is polished, deployable, and ready for 5–10 external testers.

## ✅ Overall readiness: 8.5 / 10 → **Ready after minor fixes**

The **product is functionally complete and regression-verified** (RC1 30/30 cross-platform QA, plus M5 onboarding/edit and M6 production auth, all passing). The gap to Beta is **configuration & deployment hygiene**, not product bugs — a short, well-defined punch list (mostly Firebase Console + one rule deletion + a release build). No new features are required.

---

## 1. Product audit — per-area status

| Area | Android | Website | Notes |
|---|---|---|---|
| Authentication | ✅ anonymous-first + phone | ✅ **Phone OTP** (M6), persistent, logout/login | Web needs Phone provider enabled in Console |
| Onboarding | ✅ | ✅ web-native 6-step, autosave/resume | Android-identical profile output (verified) |
| Discover | ✅ realtime | ✅ skeletons, paginated | Identical query both clients |
| Profile viewing | ✅ | ✅ states (loading/notfound/error) | — |
| Send Interest | ✅ | ✅ optimistic, dedupe | Cross-platform verified |
| Introductions | ✅ 4 live listeners | ✅ received/sent, live | — |
| Matching | ✅ atomic accept | ✅ mirror | intro+conversation+match in one txn |
| Chats | ✅ native realtime | ✅ realtime, unread, optimistic send | Cross-platform verified |
| Profile editing | ✅ | ✅ `/profile` (M5), rules-safe | — |
| Logout / Login | ✅ | ✅ stable uid → same profile (M6) | Returning member reconnects (verified) |
| Navigation | ✅ tab bar | ✅ top nav + account/logout | Web: members-only gate (M6) |
| Empty states | ✅ | ✅ all lists/detail have them | — |
| Error handling | ✅ | ✅ inline, friendly OTP errors | — |
| Loading states | ✅ | ✅ **unified this milestone** | see §2 |

**Unfinished/inconsistent from a user's POV (found):**
- (Website, **fixed**) Loading treatment was inconsistent — Discover had skeletons; Introductions/Chats/Conversation/Profile-detail had a bare left-aligned "Loading…". Unified to a shared centered spinner (`components/ui/Loading.tsx`).
- (Website, **fixed**) Browser tab title was the default "Create Next App" → now "The Nair Root".
- (Android) No UX changes were made here — the Android client is the mature, production-ready core per prior milestones; it was code-audited (states/flows present). Its main beta gate is operational (ship a **release** build, not dev — see blockers).

---

## 2. UX polish applied (this milestone — no features added)
- **Unified loading states** across the website (`PageSpinner`/`Spinner` in `components/ui/Loading.tsx`), replacing four bare "Loading…" strings — consistent, accessible (`role=status`), centered.
- **Fixed document metadata** (`<title>`/description) to the real product name.
- (M5/M6 already delivered: responsive 2-col onboarding, right-aligned constrained CTAs, accessible progress bar, disabled-CTA hints, aria-live validation, polished login screen.)
- Verified: `tsc` + `next build` clean; `/login` rendered + screenshot-reviewed at desktop & mobile.

---

## 3. Deployment review (findings + recommendations — nothing auto-removed)

🔴 = blocker · 🟡 = should-fix · 🟢 = note/leave

**Backend (shared Firebase):**
- 🔴 **Open `test` Firestore rule** — `firestore.rules` line ~308 `match /test/{docId} { allow read, write: if true; }` lets anyone read/write the `test` collection. **Remove + redeploy rules.**
- 🟡 **Composite indexes** — 14 defined in `firestore.indexes.json`; confirm all **READY** after deploy (queries fail until then).
- 🟢 **Cloud Functions** — only `onUserDeleted`; no notification producers (Notifications intentionally out of Beta 1 scope).

**Website (`nairoot-web`):**
- 🔴 **Phone Auth not yet enabled in Console** — M6 login is inert until the Phone provider + Authorized domains are set.
- 🟡 **Developer-only routes ship in the build** — `/dev/admin` + `/api/dev`. Gated by `DEV_ADMIN_SECRET` **and** the local `firebase-tools` token (absent on a host → 503, effectively inert). *Recommendation:* gate behind a prod env flag → 404, or leave inert with a strong secret. **Do not expose publicly.**
- 🟡 **Cloudinary preset** must allow web-origin uploads (else photo upload fails on web).
- 🟢 `appId` reuses the Android app id (fine for Auth/Firestore).
- 🟢 **Clean source** — zero `console.log`/`TODO`/`FIXME`, no hardcoded secrets/localhost in `src/`. `scripts/` (verify-*, emulator) are dev-only and not bundled.
- 🟢 `.env.local`, and the Android `.env`/`google-services.json`, are gitignored — supply via host/EAS env.

**Android (`matrimony-app`):**
- 🔴 (operational) **Dev build shows mock data + bypassed auth** (`__DEV__` → `MOCK_PROFILES`, mock OTP). Testers **must** get a **release/preview** EAS build.
- 🟡 **~139 `console.*` calls** across 30 files ship in release. *Recommendation:* `babel-plugin-transform-remove-console` for production. Not user-visible; not a hard blocker.
- 🟡 **Alpha/invite gate** (`EXPO_PUBLIC_ALPHA_MODE` → invite screen) — decide on/off for Beta.
- 🟢 **Diagnostic remnants** (Alert no-op shims, `mountTraceService` no-ops, `GLOBAL_FATAL_ERROR` handler) — neutered, harmless; clean up post-Beta.
- 🟢 **Dead `chatService.ts`** (0 importers) — delete in a cleanup pass.
- 🟢 Secrets gitignored. Good.

---

## 4. Remaining blockers (must clear before inviting testers)
1. 🔴 Remove the open `test` Firestore rule and redeploy rules.
2. 🔴 Enable **Phone Auth** + **Authorized domains** in the Firebase Console (website login).
3. 🔴 Add Firebase **test phone number(s)** for QA (and confirm billing for real SMS).
4. 🔴 Distribute a **release/preview Android build** (not dev).
5. 🔴 Confirm **Cloudinary** unsigned preset allows web-origin uploads.

## 5. Must-fix vs. should-fix
**Must fix before Beta:** the 5 blockers above + deploy website with env vars set + decide the `/dev/admin` route disposition.
**Should fix (not blocking Beta):** strip Android `console.*` in release; decide the alpha/invite gate; (post-Beta) delete dead `chatService.ts` and diagnostic remnants; register a dedicated web Firebase app.

## 6. Recommended launch sequence
1. **Backend first** — remove `test` rule; `firebase deploy --only firestore:rules,firestore:indexes,functions`; confirm indexes READY.
2. **Console config** — enable Phone provider, Authorized domains, test numbers; confirm Cloudinary preset.
3. **Website** — set env vars, deploy, smoke-test `/login → onboarding → discover → interest → chat → profile → logout/login`.
4. **Android** — `eas build --profile preview`, install on a device, smoke-test the same journey + cross-platform (web↔android interest + chat).
5. **Seed** a handful of starter profiles so Discover isn't empty for the first testers.
6. **Invite 5–10 testers** (web link + APK). Keep the prior website deployment + APK for one-click rollback.
7. **Watch** for the first 48h: failed logins (Console quota), photo-upload errors (Cloudinary origins), empty Discover (indexes).

## 7. Recommendation

> ### ✅ Ready after minor fixes
> The product itself is polished and verified end-to-end across both clients. The only things standing between today and a confident Beta are **deployment/configuration tasks** (one rule deletion, Console toggles, a release build, and a photo-preset check) — see the punch list in `BETA_CHECKLIST.md`. Once the 5 blockers in §4 are cleared, this is **Ready for Beta**.
