// Verifies the M5 profile-edit path (src/lib/profileEdit.ts) against live rules:
// an owner updates their public profile + private user doc and toggles
// visibility — all within the UNCHANGED Security Rules (no profileQuality/
// verifiedFields/isPremium/isConcierge writes). Self-cleans (owner deletes).
//   node --env-file=.env.local scripts/verify-profile-edit.mjs
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const app = initializeApp(cfg);
const db = getFirestore(app);
const uid = (await signInAnonymously(getAuth(app))).user.uid;
let pass = 0, fail = 0;
const ok = (l, c) => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${l}`); };

const now = Date.now();
await setDoc(doc(db, 'users', uid), { uid, phone: '+910000000000', isOnboarded: true, createdAt: now, lastActive: now });
await setDoc(doc(db, 'profiles', uid), {
  uid, name: 'Edit Test', age: 30, dob: '1995-01-01', gender: 'male', city: 'Kochi', state: 'Kerala',
  profession: 'Engineer', education: 'B.Tech / B.E', religion: 'Hindu', bio: 'Original bio.', family: 'Nuclear',
  lifestyle: [], lookingFor: 'Open to meeting anyone', photos: [], traits: [], verifiedFields: [],
  activityStatus: 'active-this-week', isPremium: false, isConcierge: false, isVisible: true,
  profileQuality: 50, createdAt: now, updatedAt: now,
});

// saveProfileEdits() field set (public profile)
await updateDoc(doc(db, 'profiles', uid), {
  name: 'Edited Name', height: `5'9"`, city: 'Munnar', state: 'Kerala', profession: 'Architect',
  education: 'B.Arch', bio: 'Edited bio after onboarding.', family: 'Joint family.',
  maritalStatus: 'never-married', motherTongue: 'Malayalam', income: '₹10–15 Lakhs',
  photos: [], traits: ['Architect', 'Munnar'], updatedAt: Date.now(),
});
// mirror into private user doc (updateUserProfile = set+merge)
await setDoc(doc(db, 'users', uid), { name: 'Edited Name', city: 'Munnar', profession: 'Architect', lastActive: Date.now() }, { merge: true });

const edited = (await getDoc(doc(db, 'profiles', uid))).data();
ok('public profile edit accepted (owner update, rules-safe)', edited.name === 'Edited Name' && edited.city === 'Munnar' && edited.profession === 'Architect');
ok('profileQuality untouched (still 50)', edited.profileQuality === 50);
ok('private user doc mirrored', (await getDoc(doc(db, 'users', uid))).data().city === 'Munnar');

// visibility toggle
await updateDoc(doc(db, 'profiles', uid), { isVisible: false, updatedAt: Date.now() });
ok('visibility toggle OFF accepted', (await getDoc(doc(db, 'profiles', uid))).data().isVisible === false);
await updateDoc(doc(db, 'profiles', uid), { isVisible: true, updatedAt: Date.now() });
ok('visibility toggle ON accepted', (await getDoc(doc(db, 'profiles', uid))).data().isVisible === true);

// cleanup (owner deletes own docs — allowed by rules)
await deleteDoc(doc(db, 'profiles', uid));
await deleteDoc(doc(db, 'users', uid));
console.log(`\nRESULT: ${pass} passed, ${fail} failed (cleaned up ${uid.slice(0, 8)}…)`);
process.exit(fail ? 1 : 0);
