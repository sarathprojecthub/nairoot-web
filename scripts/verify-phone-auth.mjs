// M6 verification — Phone-Auth STABLE IDENTITY, via the Firebase Auth emulator
// (no real SMS). This proves the core M6 guarantee that anonymous auth could not
// give: a phone number maps to a STABLE Firebase uid across logins/devices, so a
// returning member always reconnects to the same uid → same Firestore profile.
//
//   firebase emulators:exec --project demo-nairoot --config scripts/emulator/firebase.json \
//     "node scripts/verify-phone-auth.mjs"
//
// (Flow compatibility — Discover/Introductions/Matches/Chats/Editing under a
// phone-auth uid — is covered by the unchanged, auth-method-agnostic Security
// Rules + the live verify-onboarding/verify-profile-edit suites: the rules gate
// only on request.auth.uid, so a phone uid is identical to the anonymous uid the
// 30/30 QA regression already exercised.)
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const PROJECT = 'demo-nairoot';
const IDTK = `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1`;

let pass = 0, fail = 0;
const ok = (l, c) => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗ FAIL'} ${l}`); };

// Full phone sign-in over the emulator REST (the same Identity Toolkit calls the
// SDK's signInWithPhoneNumber → confirm() wrap): request a code, read it back
// from the emulator, exchange it for a session. Returns the stable uid (localId).
async function phoneSignIn(phone) {
  const sent = await fetch(`${IDTK}/accounts:sendVerificationCode?key=fake`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: phone, recaptchaToken: 'fake' }),
  });
  const { sessionInfo } = await sent.json();
  const list = await (await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT}/verificationCodes`)).json();
  const code = list.verificationCodes.filter((c) => c.phoneNumber === phone).pop().code;
  const signedIn = await (await fetch(`${IDTK}/accounts:signInWithPhoneNumber?key=fake`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionInfo, code }),
  })).json();
  return { uid: signedIn.localId, isNewUser: signedIn.isNewUser === true };
}

const PHONE_A = '+15551230001';
const PHONE_B = '+15551230002';

console.log('Phone-Auth identity (emulator):');
const a1 = await phoneSignIn(PHONE_A);
ok('First login creates an account (isNewUser)', a1.isNewUser === true);

const a2 = await phoneSignIn(PHONE_A);
ok('Same phone → SAME uid on second login (stable identity)', a1.uid === a2.uid);
ok('Second login is a returning user (not new)', a2.isNewUser === false);

const a3 = await phoneSignIn(PHONE_A);
ok('Same phone → SAME uid again (persists across logins)', a3.uid === a1.uid);

const b1 = await phoneSignIn(PHONE_B);
ok('Different phone → DIFFERENT uid', b1.uid !== a1.uid);
const b2 = await phoneSignIn(PHONE_B);
ok('Second member also has a stable uid', b2.uid === b1.uid);

console.log(`\n  member A uid: ${a1.uid}  (stable across ${3} logins)`);
console.log(`  member B uid: ${b1.uid}  (distinct, stable)`);
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
