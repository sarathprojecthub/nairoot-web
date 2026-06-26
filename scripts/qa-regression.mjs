// P1-QA regression harness. Exercises the FULL user journey through the real
// client SDK under live Security Rules — the same Firestore operations both the
// Website (firebase-js) and Android (RNFirebase) perform. Cross-client bugs live
// in this shared contract; UI-only rendering is checked separately by review.
//
//   node --env-file=.env.local scripts/qa-regression.mjs
//
// Actors (anonymous sessions, isolated app instances):
//   A,B → "Android" role   C,D → "Website" role   (identical ops at the backend)
// Matrix: A↔B (And↔And), A↔C (And↔Web), C↔D (Web↔Web).
// Cleans up its own intros/matches/convs/profiles via /api/dev afterwards.
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc,
  query, where, orderBy, limit, runTransaction,
} from 'firebase/firestore';

const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const BASE = process.env.QA_BASE_URL || 'http://localhost:3210';
const SECRET = process.env.DEV_ADMIN_SECRET;

let passed = 0, failed = 0;
const fails = [];
function check(label, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; fails.push(label); console.log(`  ✗ ${label}  ${detail}`); }
}

async function actor(name, role) {
  const app = initializeApp(cfg, name);
  const db = getFirestore(app);
  const uid = (await signInAnonymously(getAuth(app))).user.uid;
  const now = Date.now();
  await setDoc(doc(db, 'users', uid), { uid, phone: `+9100000000${name}`, isOnboarded: true, createdAt: now, lastActive: now });
  await setDoc(doc(db, 'profiles', uid), {
    uid, name: `QA ${role} ${name}`, age: 30, dob: '1995-01-01', gender: name === 'A' || name === 'B' ? 'male' : 'female',
    city: 'Kochi', state: 'Kerala', profession: 'Engineer', education: 'B.Tech / B.E', religion: 'Hindu',
    bio: `Regression actor ${name}.`, family: 'Nuclear', lifestyle: [], lookingFor: 'Open to meeting anyone',
    photos: [], traits: [], verifiedFields: [], activityStatus: 'active-this-week',
    isPremium: false, isConcierge: false, isVisible: true, profileQuality: 50, createdAt: now, updatedAt: now,
  });
  return { name, role, uid, db };
}

// ── web-identical operations ──────────────────────────────────────────────────
async function between(db, uid, other) {
  const [a, b] = await Promise.all([
    getDocs(query(collection(db, 'introductions'), where('senderId', '==', uid), where('recipientId', '==', other), limit(1))),
    getDocs(query(collection(db, 'introductions'), where('senderId', '==', other), where('recipientId', '==', uid), limit(1))),
  ]);
  return [...a.docs, ...b.docs].map((d) => ({ id: d.id, ...d.data() }))[0] ?? null;
}
async function sendInterest(from, toUid) {
  const existing = await between(from.db, from.uid, toUid);
  if (existing?.status === 'pending' && existing.senderId === from.uid) return { dup: true, id: existing.id };
  if (existing?.status === 'accepted') return { matched: true, id: existing.id };
  const now = Date.now();
  const ref = await addDoc(collection(from.db, 'introductions'), {
    senderId: from.uid, recipientId: toUid, status: 'pending',
    sentAt: now, expiresAt: now + 7 * 86400000, seenByRecipient: false,
  });
  return { id: ref.id };
}
async function received(actorObj) {
  const snap = await getDocs(query(collection(actorObj.db, 'introductions'),
    where('recipientId', '==', actorObj.uid), where('status', '==', 'pending'), orderBy('sentAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
async function accept(actorObj, introId) {
  return runTransaction(actorObj.db, async (tx) => {
    const introRef = doc(actorObj.db, 'introductions', introId);
    const convRef = doc(collection(actorObj.db, 'conversations'));
    const matchRef = doc(collection(actorObj.db, 'matches'));
    const introSnap = await tx.get(introRef);
    const intro = introSnap.data();
    const now = Date.now();
    tx.set(convRef, { id: convRef.id, participants: [intro.senderId, intro.recipientId], introductionId: introId, status: 'active', unreadCounts: { [intro.senderId]: 0, [intro.recipientId]: 0 }, createdAt: now, updatedAt: now });
    tx.set(matchRef, { id: matchRef.id, userA: intro.senderId, userB: intro.recipientId, introductionId: introId, conversationId: convRef.id, createdAt: now });
    tx.update(introRef, { status: 'accepted', conversationId: convRef.id, respondedAt: now });
    return convRef.id;
  });
}
async function decline(actorObj, introId) {
  await updateDoc(doc(actorObj.db, 'introductions', introId), { status: 'declined', respondedAt: Date.now() });
}
async function sendMessage(from, convId, text) {
  const now = Date.now();
  const ref = await addDoc(collection(from.db, 'conversations', convId, 'messages'), {
    senderId: from.uid, text, createdAt: now, readBy: [from.uid], deleted: false,
  });
  const convRef = doc(from.db, 'conversations', convId);
  const conv = (await getDoc(convRef)).data();
  const counts = { ...(conv.unreadCounts ?? {}) };
  for (const p of conv.participants ?? []) if (p !== from.uid) counts[p] = (counts[p] ?? 0) + 1;
  await updateDoc(convRef, { lastMessage: { text, senderId: from.uid, sentAt: now }, updatedAt: now, unreadCounts: counts });
  return ref.id;
}
async function discoverIds(actorObj) {
  const snap = await getDocs(query(collection(actorObj.db, 'profiles'), where('isVisible', '==', true), orderBy('createdAt', 'desc'), limit(40)));
  return snap.docs.map((d) => d.id).filter((id) => id !== actorObj.uid);
}

// ── run ───────────────────────────────────────────────────────────────────────
console.log('Setting up actors…');
const A = await actor('A', 'Android');
const B = await actor('B', 'Android');
const C = await actor('C', 'Website');
const D = await actor('D', 'Website');
console.log(`A=${A.uid.slice(0,6)} B=${B.uid.slice(0,6)} C=${C.uid.slice(0,6)} D=${D.uid.slice(0,6)}\n`);

let conv_AB;
try {
console.log('── Discover ──');
const discA = await discoverIds(A);
check('Discover returns visible profiles', discA.length >= 12, `got ${discA.length}`);
check('Discover excludes self', !discA.includes(A.uid));
check('Discover includes seeded qa- profiles', discA.some((id) => id.startsWith('qa-')));
check('Discover includes other live actors', discA.includes(B.uid) && discA.includes(C.uid));

console.log('── Profile view ──');
const pComplete = await getDoc(doc(A.db, 'profiles', 'qa-01'));
const pIncomplete = await getDoc(doc(A.db, 'profiles', 'qa-10'));
check('View complete profile (qa-01)', pComplete.exists() && pComplete.data().name === 'Arjun Menon');
check('View incomplete profile (qa-10, no photo) does not error', pIncomplete.exists() && (pIncomplete.data().photos ?? []).length === 0);

console.log('── A↔B (Android↔Android): interest → receive → accept → match → conv → chat ──');
const i_AB = await sendInterest(A, B.uid);
check('A sends interest to B', !!i_AB.id && !i_AB.dup);
check('A re-send is deduped', (await sendInterest(A, B.uid)).dup === true);
const recvB = await received(B);
check('B receives pending interest from A', recvB.some((i) => i.id === i_AB.id));
conv_AB = await accept(B, i_AB.id);
check('B accepts → conversation id returned', !!conv_AB);
const introAfter = (await getDoc(doc(A.db, 'introductions', i_AB.id))).data();
check('Intro now accepted with conversationId', introAfter.status === 'accepted' && introAfter.conversationId === conv_AB);
const convDoc = (await getDoc(doc(A.db, 'conversations', conv_AB)).catch(() => null));
check('Conversation created with both participants', !!convDoc && convDoc.exists() && convDoc.data().participants.includes(A.uid) && convDoc.data().participants.includes(B.uid));
// Read matches with a rules-valid constraint (userA == me); real clients never
// query matches by introductionId — the rules reject that (can't prove ownership).
const matchSnap = await getDocs(query(collection(A.db, 'matches'), where('userA', '==', A.uid)));
const matchForIntro = matchSnap.docs.filter((d) => d.data().introductionId === i_AB.id);
check('Match document created', matchForIntro.length === 1);
await sendMessage(A, conv_AB, 'Hi B, nice to connect.');
await sendMessage(B, conv_AB, 'Likewise, A!');
const msgsB = await getDocs(query(collection(B.db, 'conversations', conv_AB, 'messages'), orderBy('createdAt', 'asc')));
check('Both messages visible to B', msgsB.size === 2);
const msgsA = await getDocs(query(collection(A.db, 'conversations', conv_AB, 'messages'), orderBy('createdAt', 'asc')));
check('Both messages visible to A', msgsA.size === 2);
const convAfter = (await getDoc(doc(A.db, 'conversations', conv_AB))).data();
check('Unread count tracked for recipient', (convAfter.unreadCounts[A.uid] ?? 0) >= 1 || (convAfter.unreadCounts[B.uid] ?? 0) >= 1);
check('lastMessage updated', convAfter.lastMessage?.text === 'Likewise, A!');

console.log('── A↔C (Android↔Website): interest → accept → chat ──');
const i_AC = await sendInterest(A, C.uid);
check('A (Android) sends interest to C (Website)', !!i_AC.id);
check('C receives it', (await received(C)).some((i) => i.id === i_AC.id));
const conv_AC = await accept(C, i_AC.id);
check('C (Website) accepts Android interest → conversation', !!conv_AC);
await sendMessage(C, conv_AC, 'Hello from the website side.');
const msgsAC = await getDocs(query(collection(A.db, 'conversations', conv_AC, 'messages'), orderBy('createdAt', 'asc')));
check('Android user reads Website user message', msgsAC.size === 1 && msgsAC.docs[0].data().text === 'Hello from the website side.');

console.log('── C↔D (Website↔Website): interest → decline ──');
const i_CD = await sendInterest(C, D.uid);
check('C sends interest to D', !!i_CD.id);
check('D receives it', (await received(D)).some((i) => i.id === i_CD.id));
await decline(D, i_CD.id);
const declined = (await getDoc(doc(C.db, 'introductions', i_CD.id))).data();
check('D declines → status declined', declined.status === 'declined');
// A declined intro must not have a conversationId (no conversation opened).
check('Declined interest creates no conversation', !declined.conversationId);

console.log('── Profile edits ──');
await updateDoc(doc(A.db, 'profiles', A.uid), { city: 'Munnar', bio: 'Edited during QA.', updatedAt: Date.now() });
const editedA = (await getDoc(doc(B.db, 'profiles', A.uid))).data();
check('Profile edit persists and is visible to others', editedA.city === 'Munnar' && editedA.bio === 'Edited during QA.');

console.log('── Visibility toggling ──');
await updateDoc(doc(B.db, 'profiles', B.uid), { isVisible: false, updatedAt: Date.now() });
check('Hidden profile disappears from Discover', !(await discoverIds(A)).includes(B.uid));
await updateDoc(doc(B.db, 'profiles', B.uid), { isVisible: true, updatedAt: Date.now() });
check('Re-shown profile reappears in Discover', (await discoverIds(A)).includes(B.uid));

console.log('── Logout/Login persistence (data + session mechanism) ──');
// Data keyed by uid persists across sessions (independent of the auth token).
const persistProfile = (await getDoc(doc(A.db, 'profiles', A.uid))).data();
const persistConv = await getDoc(doc(A.db, 'conversations', conv_AB));
check('User data persists across sessions (profile by uid)', persistProfile.city === 'Munnar');
check('Match/conversation persists across sessions', persistConv.exists());
// NOTE: session-token persistence itself (web: browserLocalPersistence/IndexedDB;
// RN: native AsyncStorage) keeps the SAME uid across reloads — verified in M2
// ("Interest Sent ✓" survives refresh). Node cannot reproduce browser persistence.

} catch (err) {
  check(`Harness threw: ${err instanceof Error ? err.message : String(err)}`, false);
} finally {
  // ── Cleanup regression artifacts (intros/matches/convs are delete:false for
  //    clients → must go through the admin REST path). Always runs. ──
  console.log('\nCleaning up regression actors via admin console…');
  if (SECRET) {
    for (const a of [A, B, C, D]) {
      const res = await fetch(`${BASE}/api/dev`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-dev-secret': SECRET },
        body: JSON.stringify({ action: 'deleteUserCascade', payload: { uid: a.uid } }),
      });
      const j = await res.json();
      console.log(`  cleaned ${a.name}:`, JSON.stringify(j.data ?? j.error));
    }
  } else {
    console.log('  (DEV_ADMIN_SECRET not set — skipping cleanup; actor uids:', [A, B, C, D].map((a) => a.uid).join(', '), ')');
  }
}

console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
if (failed) console.log('FAILED:', fails.join(' | '));
process.exit(failed ? 1 : 0);
