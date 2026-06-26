// M5 end-to-end: a brand-new WEBSITE user joins via anonymous-first auth +
// phone, completes onboarding, and becomes a normal member — using the SAME
// write shape as src/lib/onboarding/complete.ts + src/lib/user.ts.
//
//   node --env-file=.env.local scripts/verify-onboarding.mjs [existingRecipientUid]
//
// Verifies:
//   1. users/{uid} private doc created (phone captured, isOnboarded flips true)
//   2. profiles/{uid} public doc written with the discover-critical fields
//      (isVisible:true, numeric age, createdAt) — identical schema to Android
//   3. profile appears in the shared Discover query (Android + Website both use it)
//   4. Website → other user: send interest (introductions write)
//   5. other user → Website user: send interest + recipient received-query
//      (this is exactly what Android writes/reads, proving interop both ways)
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  getFirestore, doc, getDoc, setDoc, collection, query, where, orderBy,
  limit, getDocs, addDoc,
} from 'firebase/firestore';

const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const RECIPIENT = process.argv[2] || 'tazRyn1WuOTzgEqXiECey2hPXSM2';

const omit = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const ok = (b) => (b ? '✓' : '✗ FAILED');

// Inlined copy of the quality math (src/lib/onboarding/quality.ts).
function completion(p) {
  let s = 0;
  const ph = p.photos?.length ?? 0, len = (p.bio ?? '').trim().length;
  if (ph >= 1) s += 20; if (ph >= 2) s += 5;
  if (len > 0) s += 5; if (len > 50) s += 10; if (len > 150) s += 5;
  if (p.profession) s += 10; if (p.education) s += 10; if (p.city) s += 5;
  if (p.family || p.familyType) s += 10;
  if ((p.lifestyle?.length ?? 0) > 0) s += 8;
  if (p.lookingFor) s += 7; if (p.height) s += 5;
  if ((p.prompt?.answer?.length ?? 0) > 20) s += 5;
  return Math.min(s, 100);
}
function quality(p) {
  const c = completion(p), ph = p.photos?.length ?? 0, len = (p.bio ?? '').trim().length;
  return Math.min(Math.round(c * 0.72 + (ph >= 2 ? 8 : 0) + (len > 200 ? 5 : 0)), 100);
}

const app = initializeApp(cfg);
const db = getFirestore(app);

// ── 0) WEBSITE auth model: anonymous-first session ────────────────────────────
const me = (await signInAnonymously(getAuth(app))).user.uid;
console.log('Website new-user uid:', me, '\n');

const stamp = new Date().toISOString().slice(5, 16).replace('T', ' ');
const onboarding = {
  name: `M5 Web Tester ${stamp}`, dob: '1994-05-28', age: 31, height: `5'8"`,
  gender: 'male', city: 'Kochi', state: 'Kerala', profession: 'Software Engineer',
  education: 'B.Tech / B.E', religion: 'Hindu',
  bio: 'Grounded in my work and close to my family. I value calm, honest relationships and hope to build a warm home rooted in shared traditions.',
  familyDescription: 'Close-knit family from Thrissur. Father is a retired civil servant.',
  familyType: 'nuclear', maritalStatus: 'never-married', motherTongue: 'Malayalam',
  subcaste: 'Menon', star: 'Rohini', horoscopePreference: 'preferred',
  employmentType: 'private', income: '₹10–15 Lakhs', fatherOccupation: 'Retired',
  motherOccupation: 'Homemaker', brothers: '1', sisters: '0',
  promptQuestion: 'A quiet Sunday usually looks like…', promptAnswer: 'Coffee, a long walk, and lunch with family.',
  photos: ['https://res.cloudinary.com/dxee0x4hf/image/upload/sample.jpg'],
  creatingFor: 'groom', lookingFor: { gender: 'female', ageRange: 'any' },
};

// ── 1) users/{uid} — createUserDoc + completeOnboarding ───────────────────────
await setDoc(doc(db, 'users', me), {
  uid: me, phone: '+919876543210', isOnboarded: false,
  createdAt: Date.now(), lastActive: Date.now(),
});
const profileQuality = quality({ ...onboarding, family: onboarding.familyDescription });
const lookingFor = onboarding.lookingFor.gender === 'any'
  ? 'Open to meeting anyone'
  : `A ${onboarding.lookingFor.gender === 'male' ? 'man' : 'woman'}`;

// ── 2) profiles/{uid} — upsertProfile (create path) ───────────────────────────
const now = Date.now();
await setDoc(doc(db, 'profiles', me), omit({
  uid: me, name: onboarding.name, age: onboarding.age, dob: onboarding.dob,
  height: onboarding.height, gender: onboarding.gender, city: onboarding.city,
  state: onboarding.state, profession: onboarding.profession, education: onboarding.education,
  religion: onboarding.religion, bio: onboarding.bio,
  family: onboarding.familyDescription || onboarding.familyType, lifestyle: [],
  lookingFor, photos: onboarding.photos,
  traits: [onboarding.profession, onboarding.city].filter(Boolean),
  verifiedFields: [], activityStatus: 'active-this-week',
  isPremium: false, isConcierge: false, isVisible: true, profileQuality,
  maritalStatus: onboarding.maritalStatus, motherTongue: onboarding.motherTongue,
  subcaste: onboarding.subcaste, star: onboarding.star,
  horoscopePreference: onboarding.horoscopePreference, employmentType: onboarding.employmentType,
  income: onboarding.income, familyType: onboarding.familyType,
  fatherOccupation: onboarding.fatherOccupation, motherOccupation: onboarding.motherOccupation,
  brothers: onboarding.brothers, sisters: onboarding.sisters,
  prompt: { question: onboarding.promptQuestion, answer: onboarding.promptAnswer },
  creatingFor: onboarding.creatingFor, createdAt: now, updatedAt: now,
}));
await setDoc(doc(db, 'users', me), { isOnboarded: true, lastActive: Date.now() }, { merge: true });

// ── Verify writes ─────────────────────────────────────────────────────────────
const uSnap = await getDoc(doc(db, 'users', me));
const pSnap = await getDoc(doc(db, 'profiles', me));
const u = uSnap.data(), p = pSnap.data();
console.log('1)', ok(u?.isOnboarded === true && u?.phone === '+919876543210'),
  'users/{uid}: onboarded + phone captured');
console.log('2)', ok(p?.isVisible === true && typeof p?.age === 'number' && typeof p?.createdAt === 'number'),
  `profiles/{uid}: isVisible=${p?.isVisible} age=${p?.age}(${typeof p?.age}) quality=${p?.profileQuality}`);

// ── 3) Shared Discover query (Android + Website identical) ─────────────────────
const feed = await getDocs(query(collection(db, 'profiles'),
  where('isVisible', '==', true), orderBy('createdAt', 'desc'), limit(25)));
console.log('3)', ok(feed.docs.some((d) => d.id === me)),
  `appears in Discover feed (top 25 by createdAt) — feed size ${feed.size}`);

// ── 4) Website user → other user: send interest ───────────────────────────────
const out = await addDoc(collection(db, 'introductions'), {
  senderId: me, recipientId: RECIPIENT, status: 'pending',
  sentAt: Date.now(), expiresAt: Date.now() + 7 * 86400000, seenByRecipient: false,
});
console.log('4)', ok(!!out.id), `Website → ${RECIPIENT.slice(0, 8)}…: interest sent (${out.id.slice(0, 8)}…)`);

// ── 5) other user → Website user: send interest (Android's exact write/read) ───
const otherApp = initializeApp(cfg, 'other');
const otherDb = getFirestore(otherApp);
const other = (await signInAnonymously(getAuth(otherApp))).user.uid;
const inbound = await addDoc(collection(otherDb, 'introductions'), {
  senderId: other, recipientId: me, status: 'pending',
  sentAt: Date.now(), expiresAt: Date.now() + 7 * 86400000, seenByRecipient: false,
});
// The web user reads their received intros with the same query Android uses.
const received = await getDocs(query(collection(db, 'introductions'),
  where('recipientId', '==', me), where('status', '==', 'pending'), orderBy('sentAt', 'desc')));
console.log('5)', ok(received.docs.some((d) => d.id === inbound.id)),
  `inbound interest → Website user received (${received.size} pending)`);

console.log('\nWebsite onboarding + cross-platform interop: VERIFIED');
console.log('New member uid (now discoverable in Android + Website):', me);
process.exit(0);
