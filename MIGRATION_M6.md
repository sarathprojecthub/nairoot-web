# M6 — Production Authentication & Account Identity (migration summary)

**Goal:** replace the website's per-browser **anonymous** session with a real, **portable** account so a returning member always reconnects to the same Firestore profile — with **zero** changes to Firestore collections, document schemas, or Security Rules, and full interoperability with the Android client.

**Method chosen:** Firebase **Phone Authentication (OTP)** + **require-login** access model.

---

## 1. Authentication flow

```
/login ──[enter phone, E.164]──▶ invisible reCAPTCHA ──▶ signInWithPhoneNumber
   │                                                          │ (SMS code)
   │                                                          ▼
   └──[enter 6-digit code]──▶ confirmationResult.confirm() ──▶ Firebase user (STABLE uid)
                                                              │
                              createUserDoc(uid, phone)  ◀────┘  (idempotent)
                                                              │
                    users/{uid}.isOnboarded ?  ── false ──▶ /onboarding ──▶ Complete Profile
                                               └─ true  ──▶ /discover
```

- **Phone → stable uid:** Firebase guarantees the same phone number always resolves to the **same uid**. This is the property anonymous auth lacked (anonymous = new uid per browser). It is the basis for "returning members reconnect to the same profile."
- **`lib/auth.ts`** exposes `startPhoneSignIn(phone, recaptchaId)` → `ConfirmationResult`, `confirmOtp(confirmation, code)` → `uid` (and ensures `users/{uid}`), and `logout()`.
- **`/login`** is a two-step screen (phone → code) hosting an **invisible reCAPTCHA** (`RecaptchaVerifier`, required by Firebase Phone Auth on web).
- **Onboarding no longer collects phone or signs in** — identity is already established at login; the wizard's first step is now just profile basics (name + who-for). `completeProfile` writes the same `users/{uid}` + `profiles/{uid}` as before.

## 2. Session lifecycle

- **Persistence:** `getAuth()` uses the SDK's default **IndexedDB persistence**, so the signed-in session **survives refresh and browser-close** (req #2). No code needed to "remember" the user.
- **Reactive state:** a single **`AuthProvider`** (React context over `onAuthStateChanged`) wraps the app (root `layout.tsx`) and is the one source of truth for the current user. `useUid()` and `useCurrentUser()` now read from it (no auth calls of their own).
- **Access gate:** **`RequireAuth`** guards every app page:
  - signed-out → `/login`;
  - signed-in but not onboarded → `/onboarding`;
  - signed-in + onboarded → the app.
  `/login` redirects already-signed-in users onward by onboarding state. There is **no anonymous fallback** — app data only ever loads for a real member.
- **Logout:** header **Log out** → `signOut()` (+ reCAPTCHA teardown) → `/login`. Logging back in with the same phone returns the same uid → same profile/introductions/matches/chats.

## 3. Code migrated off anonymous-only assumptions (req #7)

| File | Before | After |
|---|---|---|
| `lib/profiles.ts` `ensureAuth()` | `signInAnonymously()` if no session | returns the **current** signed-in user, else rejects `not_authenticated` (callers are behind the login guard) |
| `lib/auth.ts` | `signInWithPhone` = ensureAuth(anon) + createUserDoc | Phone-OTP: `startPhoneSignIn` / `confirmOtp` / `logout` |
| `hooks/useUid.ts`, `hooks/useCurrentUser.ts` | called `ensureAuth()` (anonymous) | read the `AuthProvider` |
| `components/onboarding/Wizard.tsx` | step 0 collected phone + `signInWithPhone` | identity from login; step 0 = profile basics |
| `app/(app)/layout.tsx` | anonymous browsing + `JoinBanner` | wrapped in `RequireAuth`; `JoinBanner` removed |
| `components/AccountNav.tsx` | "Complete profile" / "Member" | Profile link + **Log out** |
| **new** | — | `AuthProvider`, `RequireAuth`, `/login` |

## 4. Compatibility with Android (req #5, #6)

- **No Firestore changes.** Collections, document schemas, and Security Rules are **untouched**. The rules gate only on `request.auth != null` and `request.auth.uid` — they do **not** care how a user authenticated. A **phone-auth uid is identical, to the rules, to the anonymous uid it replaces**.
- **Android is unaffected.** Android keeps its anonymous-first model; its uids and the website's phone-auth uids are both ordinary `uid`s. Because Discover, Introductions, Matches, Chats, and Profile-editing are all **uid-keyed**, the two clients remain fully interoperable — an Android user and a website user discover each other, send/accept interests, match, and chat exactly as before.
- **Existing data:** the ~test profiles created under anonymous uids are not migrated (there are no production members yet). From M6 onward, real website members onboard under their **phone-auth uid from day one**, so reconnection is guaranteed. (No anonymous→permanent linking is needed because anonymous sessions are removed entirely.)

## 5. Verification

| Check | Result |
|---|---|
| Phone → **stable uid** across 3 logins; `isNewUser` flips false on return; distinct phones → distinct uids (Auth emulator, `scripts/verify-phone-auth.mjs`) | ✅ 6/6 |
| Returning member reconnects to the **same uid → same profile** (corollary of stable uid) | ✅ |
| Live flow contract unregressed after migration — onboarding writes Android-identical profile, discoverable, interest both directions (`verify-onboarding.mjs`) | ✅ 5/5 |
| Profile editing under the unchanged rules (`verify-profile-edit.mjs`) | ✅ 5/5 |
| `tsc --noEmit` + `next build` | ✅ clean (`/login`, `/onboarding`, `/discover`, `/profile`) |

> Flow compatibility under a phone-auth uid is covered by the unchanged, **auth-method-agnostic** rules + the suites above (the 30/30 QA regression already exercised Discover/Introductions/Matches/Chats under authenticated uids). The OTP send/receive itself can't be exercised without real SMS from this environment; it is verified mechanically via the Auth emulator.

## 6. Production setup required (one-time, Firebase Console)

1. **Enable** the **Phone** sign-in provider (Authentication → Sign-in method).
2. Add the deploy domain(s) to **Authorized domains** (reCAPTCHA / Phone Auth).
3. For QA without real SMS, add **test phone numbers** (Authentication → Sign-in method → Phone → Test numbers) — e.g. a number → fixed code.
4. (Optional) Register a dedicated **Web app** for a web `appId` (currently the Android appId is reused — fine for Auth/Firestore).

**Out of scope (unchanged):** Premium, Notifications, Payments, Admin enhancements, iOS.
