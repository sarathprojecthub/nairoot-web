# PROJECT_STATE — The Nair Root

> Single source of truth for the current state of the platform. Kept in both repos
> (`matrimony-app` = Android, `nairoot-web` = Website). Update this when architecture,
> milestones, or known limitations change.

_Last updated: end of "Android Stability & SDK Completion" milestone._

> ⚠️ **Current beta truth (2026-06 cleanup).** Login is **Firebase Email + Password** on **both**
> web and Android — **phone/OTP is future roadmap, not current beta.** **Premium** is **coming
> soon (waitlist); no payments are wired** — every member keeps full access free during beta.
> **Notifications** are **in-app realtime only** (pending-introduction badge, Discover banner,
> Introductions + Chats badges) — **no push/FCM.** Some sections below predate this and still
> describe the earlier phone-auth / paid-premium plan; treat this note as authoritative.

---

## 1. Architecture overview

A Nair-community matrimony/introductions platform with **two clients sharing one Firebase backend**:

- **Android app** — `matrimony-app/` — Expo / React Native (New Architecture), Expo Router, Zustand. Talks to Firestore via **`@react-native-firebase` (native SDK)** for all realtime + critical paths.
- **Website** — `nairoot-web/` — Next.js (App Router) + Tailwind. Talks to Firestore via the **Firebase JS Web SDK**.
- **Backend** — Firebase project **`nairoot-app`** (project # 289843251959): Firestore (shared schema, rules, composite indexes), Firebase Auth (anonymous + phone), Storage. One Cloud Function only: `onUserDeleted` (auth `onDelete` cleanup). **No Firestore-trigger Cloud Functions exist.**

The two clients are **independent codebases** (deliberately not a monorepo yet — see §9). They share the data model by convention, not by a shared package.

**Auth model:** anonymous-first. The app calls `signInAnonymously()` to establish a uid immediately; phone collection + a `users/{uid}` doc follow (V2 adds phone-OTP fields). Web reuses this exact model: anonymous session + phone on `users/{uid}`, then the M5 onboarding writes `profiles/{uid}` (no separate web auth system). Security Rules treat anonymous users as authenticated (`request.auth != null`).

---

## 2. Firebase collections & document schemas

Authoritative TS types: `matrimony-app/src/types/db.ts`. All timestamps are **Unix-ms `number`** (client writes `Date.now()`).

| Collection | Doc ID | Purpose / key fields | Access |
|---|---|---|---|
| `users/{uid}` | uid | private: `phone`, `fcmToken`, `blockedUids`, `hiddenProfileIds`, `membershipTier`, `privacySettings`, `isOnboarded` | owner-only R/W (membership fields functions-only) |
| `profiles/{uid}` | uid | public: `name, age, dob, gender, city, profession, education, religion, photos[], bio, lookingFor, verifiedFields[], isVisible, isPremium, isConcierge, profileQuality, createdAt` | any authed read (unless hidden); owner+functions write |
| `introductions/{id}` | auto | `senderId, recipientId, status(pending/accepted/declined/archived/expired/blocked), note?, conversationId?, sentAt, expiresAt, seenByRecipient` | read = sender or recipient |
| `conversations/{id}` | auto | `participants[2], introductionId, status(active/archived), lastMessage?, unreadCounts{uid:n}, createdAt, updatedAt` | participants only |
| `conversations/{id}/messages/{id}` | auto | `senderId, text, createdAt, readBy[], deleted, moderationFlag?` | participants only |
| `matches/{id}` | auto | `userA, userB, introductionId, conversationId, createdAt` (created atomically on accept) | participants |
| `notifications/{id}` | auto | `recipientUid, type, title, body, read, createdAt, related*Id` — **written by functions (none exist yet → collection is empty in prod)** | recipient read/update; create=functions only |
| `profileViews/{id}` | auto | `viewerUid, viewedUid, viewedAt, source` — **write-only, never read in app** | authed write |
| `onboardingDrafts/{uid}` | uid | per-step onboarding save (1–9); deleted on completion | owner R/W |
| `reports`, `blocks`, `memberships`, `conciergePicks`, `verificationRequests`, `verificationReviews`, `moderation`, `photoModerationFlags` | — | safety / payments / concierge / verification / moderation | mostly write-only or admin-only |

**Composite indexes (deployed, `firestore.indexes.json`):** `profiles(isVisible,createdAt)` **and** `profiles(isVisible,{city|religion},createdAt|profileQuality)`; `introductions(senderId|recipientId,[status],sentAt)`; `conversations(participants array-contains,status,updatedAt)`; `notifications(recipientUid,[read],createdAt)`; `messages(convId,createdAt)`; `profileViews(view{er,ed}Uid,createdAt)`.

**Security Rules (`firestore.rules`) — key invariants:** `isValidIntroduction` requires `senderId==auth.uid`, `status=='pending'`, `seenByRecipient==false`, `note` optional/string; conversation create requires the introduction's `recipientId==auth.uid` + sender in participants; match create requires `recipientId==auth.uid`; message create requires `senderId==auth.uid`, non-empty text ≤2000, conversation `status=='active'`, isParticipant. **Do not change rules/collections/shapes without updating both clients.**

---

## 3. Android status — **production-ready (core)**

- **Realtime stack: 100% native RNFirebase.** Discover feed, introductions (4 listeners), notifications (badge), and **conversations + messages** all use `@react-native-firebase/firestore`.
- **No JS-SDK realtime listeners in steady state.** (Only dead `src/services/chatService.ts` still contains a JS-SDK `onSnapshot` — 0 importers, never executes; intentionally left, see §6.)
- One-shot reads/writes in ~80 "founder/ops/trust/atmosphere/learning" services still use the JS Web SDK (`db` in `firebase.ts`) — request/response only, not assertion-prone (see §6).
- **Resolved this program:** the `FIRESTORE (11.x) "Unexpected state"` assertion (was the JS-SDK long-polling listeners → migrated); the chat "Connection issue" banner; the onboarding→Discover **white screen** (`freezeOnBlur: true` on the onboarding stack); the app-wide **ANR** dialog storm (diagnostic `Alert.alert` instrumentation disabled in auth lifecycle); **Send Interest** failure (`note: undefined` rejected by RNFirebase → omitted); empty **Discover** (missing `isVisible+createdAt` composite index → deployed).
- Tabs (member-facing): **Discover · Introductions · Chats · Profile** (Activity + premium + firebase-diagnostics hidden via `href:null`, routes preserved for debugging).
- Dev/mock: `__DEV__ || MOCK_AUTH_ENABLED` bypasses Firebase with AsyncStorage-only mock sessions.

---

## 4. Website status — **first-class client, beta-ready (M0–M6)**

`nairoot-web/` — Next 16, React 19, Tailwind v4, Firebase JS SDK → project `nairoot-app`.

- **Discover** (`/discover`, `/discover/[id]`): same query as Android (`isVisible==true, orderBy createdAt desc`), responsive desktop-first grid, profile detail.
- **Send Interest**: writes `introductions` with the exact Android schema (omits `note`); dedupe; realtime "Interest Sent ✓".
- **Introductions** (`/introductions`): Received/Sent, Accept/Decline; **accept mirrors Android's transaction exactly** (creates `conversation` + `match`, sets intro `accepted`).
- **Chats** (`/chats`, `/chats/[id]`): conversations list, realtime messages, composer, auto-scroll, unread — a verbatim mirror of Android `conversationService`.
- **Onboarding** (`/onboarding`): web-native multi-step wizard — **6 grouped steps** (profile basics → about → where & work → family & story → photos → review), responsive desktop/mobile, autosave + furthest-incomplete resume, keyboard-friendly. The **business logic is ported from Android** (`src/lib/onboarding/*` from `onboardingStore`/`profileQualityService`/`preview.tsx`) — same fields, validation, `onboardingDrafts/{uid}` resume, and `users/{uid}` + `profiles/{uid}` write shape. Photos reuse the **same Cloudinary** unsigned preset. Completed profiles set `isVisible:true` + numeric `age` + `createdAt` → appear immediately in **both** Android and Website Discover.
- **Profile editing** (`/profile`): edit fields, manage photos, toggle visibility — rules-safe updates (never writes `profileQuality`/`verifiedFields`/`isPremium`/`isConcierge`).
- Auth: **Email + Password** (`createUserWithEmailAndPassword` / `signInWithEmailAndPassword`). For the **Spark/free-plan beta**, web auth was switched from Phone OTP to Email+Password to avoid SMS billing (M6 introduced Phone OTP; it requires the Blaze plan). **Same uid-based architecture** — `AuthProvider`/`RequireAuth`, persistent session (IndexedDB), require-login gate, logout/login — and **no Firestore schema/rule changes** (an email-auth uid is an ordinary `request.auth.uid`). The phone `users/{uid}` field is simply left empty for email accounts. `MIGRATION_M6.md` documents the original phone flow; the phone helpers were removed from `lib/auth.ts`.
- Verified bidirectional Website↔Android interop for discover/interest/accept/chat/onboarding (`scripts/verify-*.mjs`), and stable phone identity via the Auth emulator (`verify-phone-auth.mjs`).

---

## 5. Completed milestones

- **M0** — Next.js app scaffolded, Firebase + Tailwind configured, Firestore connection to `nairoot-app` verified.
- **M1** — Website **Discover** (read-only, responsive grid + detail).
- **M2** — Website **Send Interest** → writes `introductions`; verified Website→Android.
- **M3** — Website **Introductions & Accept** (conversation + match creation); verified Android↔Website matching.
- **M4** — Website **Chats** (realtime, cross-platform); verified Website↔Website and Website↔Android.
- **M5** — Website **Auth & Onboarding** (then restructured into a web-native 6-step wizard) + **profile editing**. Android-identical profile writes; cross-platform discovery + interest verified.
- **P1 / QA / RC1** — internal dev-admin console (server-only, rules-bypassing via firebase-tools token); full QA regression (30/30 across And↔And/And↔Web/Web↔Web); tagged **`RC1`** in both repos as the rollback point.
- **M6** — Website **Production Authentication**: anonymous → **Phone OTP**, stable portable uid, persistent session, require-login gate, logout/login. No schema/rule changes; interop preserved. Verified (identity 6/6 emulator + live flow suites).
- **Beta Launch Prep** — removed the open `/test` Firestore rule + **redeployed rules & indexes**; gated `/dev/admin`+`/api/dev` to 404 in production (`DEV_ADMIN_ENABLED`); strip `console.log/info` from Android release builds; verified Cloudinary upload + Phone-Auth provider enabled. Full regression green under tightened rules. See `BETA_LAUNCH_REPORT.md` → **GO (conditional on deploy actions)**.
- **Android Stability & SDK Completion** — migrated conversation realtime listeners (`conversationService`) to native RNFirebase; **no JS-SDK realtime in steady state**; no "Unexpected state" assertions; no connection banner; Discover/Introductions/Chats regression-passed.

---

## 6. Remaining technical debt

- **Android one-shot JS-SDK usage:** ~80 services + the `firebase.ts` `db` instance (with `experimentalForceLongPolling`) still use the JS Web SDK for getDoc/setDoc/getDocs/batch. Non-realtime, not assertion-prone. **Documented, intentionally not migrated** (out of scope; do in a dedicated pass).
- **Dead code:** `matrimony-app/src/services/chatService.ts` (0 importers, contains a JS-SDK `onSnapshot`, never runs) — left as-is by request; delete in the cleanup pass.
- **Diagnostic instrumentation remnants:** auth-lifecycle `Alert.alert` calls are disabled via a no-op shim (not deleted) in `authStore.ts`/`authService.ts`; `mountTraceService` is neutered to no-ops; `app/_layout.tsx` still has a `GLOBAL_FATAL_ERROR` handler and AsyncStorage mount-trace readback. Clean up later.
- **Web Firebase appId** uses the **Android** appId (fine for Auth/Firestore; register a dedicated Web app for Analytics/Web Push).
- **No shared package** between repos — types/logic are duplicated by convention (planned extraction, §9).

---

## 7. Known limitations

- **Notifications / Activity tab is non-functional in prod:** nothing writes `notifications` docs (no Firestore-trigger Cloud Functions). The Android Activity tab is a UI shell over an empty collection (hidden from the tab bar). Web has no notifications.
- **Web users without a profile** (haven't onboarded) still browse anonymously and render as "A member" placeholder in Android Introductions/Chats. Real web onboarding now exists (M5) — completing it makes the web user a fully discoverable member with parity to Android.
- **Android phone auth** needs Firebase test numbers or real SMS; `RecaptchaVerifier` works on web but not RN (dev bypass exists for Android).
- **`profileViews`** is written but never read (no "who viewed you" feature).
- **`profiles.age`**: a numeric value outside the default Discover age band (24–38) is filtered out; missing `createdAt` makes a profile invisible to Discover (orderBy). Onboarding sets both correctly.

---

## 8. Pending roadmap (next product phase)

1. ~~**Website auth + onboarding**~~ — **done (M5).** Real web accounts/profiles; discoverable web users; cross-platform matching verified.
2. **Notification producer** — Firestore-trigger Cloud Functions to populate `notifications` (intro received/accepted, message received) → lights up Activity + push.
3. **Premium / payments** (web: Razorpay/Stripe; app: IAP) and the `memberships` flow.
4. **Web push / FCM-web**; responsive nav polish.
5. **iOS** (Expo) — not started.
6. **Infra cleanup pass** — migrate remaining Android one-shot JS-SDK calls to native, delete dead code, extract shared `types`/`logic` packages (monorepo).

---

## 9. Important implementation decisions (read before contributing)

- **Dual-SDK on Android is deliberate and being phased out.** Native RNFirebase = auth + all realtime + critical-path collections (users, profiles, introductions, conversations, messages, notifications). JS Web SDK (`firebase.ts` `db`) = legacy one-shot reads only. **New realtime code must be native.** The JS-SDK realtime stream was the source of the `Unexpected state` assertion — never reintroduce a JS-SDK `onSnapshot` on Android.
- **RNFirebase rejects `undefined` field values** (no `ignoreUndefinedProperties` set). Omit optional fields entirely (e.g., `note`) or use the `omitUndefined()` helper in `profileService`. This caused the Send-Interest bug.
- **Composite indexes must be deployed** (`firebase deploy --only firestore:indexes`). A query using `where(equality) + orderBy(otherField)` fails with `FAILED_PRECONDITION` until the index is READY. The empty-Discover bug was an undeployed `isVisible+createdAt` index. Indexes are declared in `firestore.indexes.json` and currently all deployed.
- **Introduction acceptance is one transaction** (create `conversation` + `match`, set intro `accepted`). The web mirrors the Android `acceptIntroduction` byte-for-byte. Rules require the **recipient** to perform it.
- **Web independence:** the Next.js app is standalone (no monorepo) to ship fast; shared-package extraction is a deliberate later refactor.
- **`freezeOnBlur: true`** on the onboarding stack (`app/(onboarding)/_layout.tsx`) prevents a Fabric reparenting white-screen during onboarding→Discover.
- **Verification tooling:** read-only Firestore inspection uses the firebase-tools stored token via the Firestore REST API (admin/IAM, bypasses rules) — see `nairoot-web/scripts/*.mjs` and `matrimony-app/anr-evidence/*.cjs`. Useful for cross-client debugging; not shipped.
- **Same backend, real data:** both clients read/write live `nairoot-app` data. The collection currently holds ~28 test profiles (gibberish names) from prior testing.
