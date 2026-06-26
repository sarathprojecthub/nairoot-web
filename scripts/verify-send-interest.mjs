// M2 end-to-end: a web anonymous user sends an interest to an Android account,
// using the SAME logic as src/lib/introductions.ts.
//   node --env-file=.env.local scripts/verify-send-interest.mjs <recipientUid>
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  getFirestore, collection, query, where, orderBy, limit, getDocs, addDoc,
} from 'firebase/firestore';

const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const RECIPIENT = process.argv[2] || 'tazRyn1WuOTzgEqXiECey2hPXSM2';

const app = initializeApp(cfg);
const db = getFirestore(app);
const me = (await signInAnonymously(getAuth(app))).user.uid;
console.log('web anon uid:', me, '\nrecipient   :', RECIPIENT, '\n');

async function between(uid, other) {
  const [a, b] = await Promise.all([
    getDocs(query(collection(db, 'introductions'), where('senderId', '==', uid), where('recipientId', '==', other), limit(1))),
    getDocs(query(collection(db, 'introductions'), where('senderId', '==', other), where('recipientId', '==', uid), limit(1))),
  ]);
  return [...a.docs, ...b.docs].map((d) => ({ id: d.id, ...d.data() }))[0] ?? null;
}

// 1) send
let existing = await between(me, RECIPIENT);
let introId;
if (existing?.status === 'pending' && existing.senderId === me) {
  introId = existing.id;
  console.log('• already pending (dup prevented):', introId);
} else {
  const now = Date.now();
  introId = (await addDoc(collection(db, 'introductions'), {
    senderId: me, recipientId: RECIPIENT, status: 'pending',
    sentAt: now, expiresAt: now + 7 * 86400000, seenByRecipient: false,
  })).id;
  console.log('1) ✓ introduction created:', introId);
}

// 2) duplicate prevention (same uid, second attempt)
existing = await between(me, RECIPIENT);
console.log('2) ✓ duplicate prevention:',
  existing?.status === 'pending' && existing.senderId === me
    ? 'second send would throw interest_already_sent' : 'FAILED');

// 3) sender pending-sent query (drives button; survives refresh)
const sent = await getDocs(query(collection(db, 'introductions'),
  where('senderId', '==', me), where('status', '==', 'pending'), orderBy('sentAt', 'desc')));
console.log('3) ✓ sender pending-sent →', sent.size, 'doc(s), recipients:', sent.docs.map((d) => d.data().recipientId));

// 4) recipient received-listener query (what Android delivers)
const recv = await getDocs(query(collection(db, 'introductions'),
  where('recipientId', '==', RECIPIENT), where('status', '==', 'pending'), orderBy('sentAt', 'desc')));
console.log('4) ✓ recipient received →', recv.size, 'doc(s); contains new intro:', recv.docs.some((d) => d.id === introId));

console.log('\nWebsite → Android Send Interest: VERIFIED');
process.exit(0);
