# QA Report — Release Candidate Gate (RC1)

**Product:** The Nair Root — Android app (`matrimony-app/`) + Website (`nairoot-web/`), shared Firebase backend `nairoot-app`.
**Milestone:** Product Validation & QA → RC1 gate.
**Date:** 2026-06-26.
**Verdict:** ✅ **All critical paths pass (30/30, two consecutive clean runs). Build declared Release Candidate 1 (RC1)** — subject to the operational must-fix in §7.

---

## 1. Scope & objective

Validate the complete user journey end-to-end across the three client-pairing combinations and eliminate functional/data-integrity/crash/broken-flow defects before opening the product to a small group of external testers. **No new features**; fixes limited to defects in those four categories.

Flows under test: Discover · Profile view · Send Interest · Receive Interest · Accept · Decline · Match creation · Conversation creation · Chat · Logout/Login persistence · Profile edits · Visibility toggling.

---

## 2. Methodology

The two clients (**Website** = Firebase JS SDK, **Android** = `@react-native-firebase`) perform **byte-identical Firestore operations** against one backend and one ruleset. Cross-client bugs therefore live in that **shared backend contract**, which is exactly what was exercised here:

- **Automated regression** (`scripts/qa-regression.mjs`): four real **anonymous client sessions** (isolated SDK app instances) drive every flow through the *real* Firestore operations **under the live Security Rules** — the same reads/writes/transactions both clients issue. This catches rule regressions, permission failures, transaction/data-integrity bugs, and dedupe logic.
- **Dataset seeding** via the **admin console backend** (`/api/dev`, `scripts/qa-seed.mjs`).
- **UI rendering** (card layouts, placeholders for incomplete profiles, photo fallback) verified by **code review** of `ProfileCard`/`ProfilePhoto`/`dbProfileToMockProfile`, plus the live Android↔Website device interop verified in milestones **M1–M5**.

**Honest limitation:** this pass did not click through the physical Android APK or a live browser session (no device/browser automation in this environment). The data + logic + rules contract is fully covered; a final **manual smoke** on a preview Android build and a browser is the recommended last step before testers (see §7).

---

## 3. Test dataset

Seeded via the admin console — **12 realistic profiles** (`qa-01`…`qa-12`), all `isVisible:true` and discoverable:

| Span | Values |
|---|---|
| Ages | 24, 25, 26, 27, 28, 29, 30, 32, 33, 35, 38, 41 |
| Locations | Kochi, Trivandrum, Bangalore, Kottayam, Kozhikode, Chennai, Hyderabad, Mumbai, Palakkad, Pune, Delhi, Ernakulam |
| Professions | Engineer, Doctor, PM, Architect, Lawyer, CA, Data Scientist, Entrepreneur, Teacher, Civil Servant, Designer, (blank) |
| Religions | Hindu ×7, Christian ×2, Muslim ×1, Jain ×1, + 1 unspecified path |
| Completeness | 8 complete (photo + bio + family + education) · **4 intentionally incomplete** (no photo / sparse or no bio / missing education / missing profession) |
| Photos | Real portrait images (randomuser.me) |

The dataset is **left in place** for external testers. Transient regression actors are auto-cleaned each run (intros/matches/conversations are `delete:if false` for clients, so cleanup routes through the admin path).

---

## 4. Test matrix & results

Pairings: **A↔B = Android↔Android**, **A↔C = Android↔Website**, **C↔D = Website↔Website** (roles label the client; operations are identical at the backend).

| # | Scenario | Pairing | Result |
|---|---|---|---|
| 1 | Discover returns visible profiles | all | ✅ |
| 2 | Discover excludes self | all | ✅ |
| 3 | Discover includes seeded dataset | all | ✅ |
| 4 | Discover includes other live users | all | ✅ |
| 5 | Profile view — complete profile | A→qa-01 | ✅ |
| 6 | Profile view — incomplete profile (no photo) does not error | A→qa-10 | ✅ |
| 7 | Send Interest | A→B (And↔And) | ✅ |
| 8 | Duplicate interest is deduped | A→B | ✅ |
| 9 | Receive Interest (pending) | B | ✅ |
| 10 | Accept → conversation id returned | B | ✅ |
| 11 | Intro transitions to `accepted` + `conversationId` | A↔B | ✅ |
| 12 | Conversation created with both participants | A↔B | ✅ |
| 13 | Match document created | A↔B | ✅ |
| 14 | Chat — both messages visible to recipient | A↔B | ✅ |
| 15 | Chat — both messages visible to sender | A↔B | ✅ |
| 16 | Unread count tracked for recipient | A↔B | ✅ |
| 17 | `lastMessage` updated on conversation | A↔B | ✅ |
| 18 | Send Interest cross-platform | A→C (And↔Web) | ✅ |
| 19 | Receive cross-platform | C | ✅ |
| 20 | Accept cross-platform → conversation | C | ✅ |
| 21 | Cross-platform chat delivered & read | A↔C | ✅ |
| 22 | Send Interest | C→D (Web↔Web) | ✅ |
| 23 | Receive | D | ✅ |
| 24 | **Decline** → status `declined` | D | ✅ |
| 25 | Declined interest creates **no** conversation | C↔D | ✅ |
| 26 | Profile edit persists & visible to others | A | ✅ |
| 27 | Visibility OFF → removed from Discover | B | ✅ |
| 28 | Visibility ON → reappears in Discover | B | ✅ |
| 29 | Data persists across sessions (profile by uid) | A | ✅ |
| 30 | Match/conversation persists across sessions | A | ✅ |

**Totals: 30 passed / 0 failed.** Reproduced on two consecutive runs with clean idempotent teardown.

> **Logout/Login persistence note (29–30):** uid-keyed data persists in Firestore independent of the session. Session-*token* persistence (the same uid surviving a reload) is handled by SDK platform persistence — web `browserLocalPersistence` (IndexedDB), Android RNFirebase native — and was verified live in **M2** ("Interest Sent ✓" survives refresh). Node cannot reproduce browser/native token persistence, so it is asserted at the data layer + cited from M2 rather than re-clicked here.

---

## 5. Defects found & fixes applied

**Functional defects in the regression flows: 0** — all 30 product behaviors passed under the live ruleset. **One build-integrity defect** was found later, during the fresh-clone RC1 gate (B-1 below), and fixed.

| ID | Where | Issue | Category | Fix |
|---|---|---|---|---|
| B-1 | `matrimony-app` `app/_layout.tsx:52` | `segments[1]` (from expo-router `useSegments()`) fails `tsc` (TS2493) against the **lockfile-pinned** expo-router types, which infer `segments` as a length-1 tuple. The working repo only passed because its installed `node_modules` had drifted to a looser type; a **fresh clone did not type-check**. Runtime behavior was already correct (`undefined` → not on invite screen). | Build integrity | Index as `(segments as string[])[1]` so it type-checks across expo-router versions. Verified by re-clone + `npm ci` + type-check. |
| H-1 | `qa-regression.mjs` | Asserted match creation by querying `matches where introductionId == …`. Firestore **rejects** this (`permission-denied`) because the `matches` read rule (`userA/userB == uid`) can't prove the query only returns readable docs. Real clients never query this way. | Harness correctness | Query with a rules-valid constraint (`where userA == me`) and filter `introductionId` in memory. |
| H-2 | `qa-regression.mjs` | Verified "no conversation after decline" by querying `conversations where introductionId == …` — same rules limitation (participant-only reads). | Harness correctness | Assert the declined introduction has no `conversationId` (an owner-readable field). |

> **Fresh-clone build gate (RC1):** both repos were re-cloned from the `RC1` tag and built from scratch — **nairoot-web** (`npm ci` → `tsc` → `next build`) and **matrimony-app** (`npm ci` root + `functions/` → `npm run type-check`). Both clean after B-1. Note: `matrimony-app/functions/` is a **separate npm sub-project** and needs its own `npm ci`. A full native Android APK build (gradle + `google-services.json` + native toolchain) is out of scope for this environment and was validated previously via EAS.

Also hardened the harness with `try/finally` so cleanup always runs (the first crash had left 4 orphan actors; removed via `scripts/qa-cleanup.mjs`).

**Important:** H-1's failure actually *confirmed* product correctness — the admin cascade showed the recipient owned exactly **1 intro + 1 match + 1 conversation** per accept, i.e. the atomic accept transaction is sound.

---

## 6. Verified invariants (data integrity)

- Accept is **one atomic transaction**: creates `conversation` + `match`, sets intro `accepted` + `conversationId` — all-or-nothing.
- Decline sets `declined` and creates **no** conversation/match.
- Duplicate interest is prevented (dedupe before write).
- Discover query identical on both clients (`isVisible==true, orderBy createdAt desc`); base feed has **no** age filter, so all seeded ages (24–41) appear.
- Incomplete profiles (missing photo/bio/education/profession) are handled by defensive defaults in both clients (`dbProfileToMockProfile` and web `mapProfile` use `?? `), so a single bad doc cannot blank the feed.
- Security Rules forbid client deletion of `introductions`/`matches`/`conversations` (`delete:if false`) — protects history integrity.

---

## 7. Remaining known issues (classified)

### 🔴 Must fix before beta
- **MF-1 — Distribute a non-dev Android build to testers.** The Android **dev** build intentionally shows `MOCK_PROFILES` in Discover (`__DEV__` path in `discoverStore`) and bypasses auth (mock OTP `123456`). Testers must receive a **preview/production** build (`eas build --profile preview/production`), or they will not see the live seed dataset or real cross-platform behavior. *Operational, not a code change.*
- **MF-2 — Final manual smoke before opening to testers.** Run one real pass on a physical Android (preview build) + a browser: onboard a web user, send/accept an interest across platforms, exchange a chat message, reload to confirm session persistence. Covers the UI layer this automated pass could not click.
- **MF-3 — Confirm Cloudinary preset allows web-origin uploads.** Onboarding/admin photo upload uses the unsigned `bandhan_photos` preset; verify it accepts browser-origin uploads so web onboarding photos succeed for testers.

### 🟡 Can fix after beta
- **CA-1 — Website has no end-user Profile screen.** After onboarding, web users can't edit their profile or toggle visibility from the UI (works on Android and via admin console). Discover/interest/chat are unaffected.
- **CA-2 — Web auth is anonymous + phone (no portable login).** A returning user on a new browser/device gets a new identity; phone is captured but not OTP-verified. Fine for single-browser testers; revisit with real phone-OTP login.
- **CA-3 — Notifications/Activity inert.** No Cloud Functions write `notifications`, so there is no push/in-app alert on new interest/message; testers must open the app to see updates. (Known platform gap.)
- **CA-4 — No client-side conversation/interest removal.** By design (`delete:if false`); archive fields exist in schema but no UI. Revisit with archive UX.

### 🟢 Nice to have
- **NH-1 — Web Discover is one-shot (no realtime).** New profiles appear after a reload on web; Android Discover is realtime (`onSnapshot`). No broken flow.
- **NH-2 — Web account/profile menu** in the header (currently a "Member" marker / Complete-profile CTA only).

---

## 8. Release readiness assessment

| Critical path | Status |
|---|---|
| Discover (both clients, incl. incomplete profiles) | ✅ |
| Profile view | ✅ |
| Send / Receive Interest (incl. dedupe) | ✅ |
| Accept / Decline | ✅ |
| Match + Conversation creation (atomic) | ✅ |
| Chat (cross-platform, unread, lastMessage) | ✅ |
| Profile edits | ✅ |
| Visibility toggling | ✅ |
| Persistence (data layer + cited M2) | ✅ |
| Cross-platform interop (And↔And, And↔Web, Web↔Web) | ✅ |

**All critical functional and data-integrity paths pass with zero product defects, reproducibly.** Remaining items are scoped enhancements or operational steps, none of which break a core flow.

### ✅ This build is declared **Release Candidate 1 (RC1).**

**Recommendation:** complete **MF-1/MF-2/MF-3** (operational: ship a preview Android build, run the manual smoke, confirm the Cloudinary preset) and the product is ready for a small, trusted external tester group. Address the 🟡 items during/after beta based on tester feedback.

---

## 9. Artifacts

- `scripts/qa-seed.mjs` — seeds the 12-profile dataset via the admin console.
- `scripts/qa-regression.mjs` — 30-check regression harness (real client SDK, live rules, self-cleaning).
- `scripts/qa-cleanup.mjs` — removes regression actors (`--seed` also clears the seed dataset).
- Re-run: `PORT=3210 npm run start` → `node --env-file=.env.local scripts/qa-regression.mjs`.
