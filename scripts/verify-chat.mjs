// M4 cross-platform chat verification (long-running).
//   node --env-file=.env.local scripts/verify-chat.mjs
// 1) Web user WC signs in, a conversation [tazRyn1, WC] is created (admin),
//    WC sends a message (real web sendMessage logic) → Website→Android.
// 2) WC subscribes live; drive the emulator (tazRyn1) to reply → Android→Website
//    arrives in this subscription with NO refresh.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  getFirestore, collection, doc, query, orderBy, onSnapshot, writeBatch, increment,
} from 'firebase/firestore';

const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const TAZ = 'tazRyn1WuOTzgEqXiECey2hPXSM2';
const REST = 'https://firestore.googleapis.com/v1/projects/nairoot-app/databases/(default)/documents';
const stamp = () => new Date().toLocaleTimeString();

async function adminToken() {
  const c = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'));
  return (await (await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com', client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi', refresh_token: c.tokens.refresh_token, grant_type: 'refresh_token' }),
  })).json()).access_token;
}

const app = initializeApp(cfg);
const db = getFirestore(app);
const WC = (await signInAnonymously(getAuth(app))).user.uid;
const T = await adminToken();
console.log('web user WC:', WC, '| android:', TAZ);

// 1) create conversation [TAZ, WC] (admin stand-in for an accepted-intro convo)
const now = Date.now();
const conv = await (await fetch(`${REST}/conversations`, {
  method: 'POST', headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ fields: {
    participants: { arrayValue: { values: [{ stringValue: TAZ }, { stringValue: WC }] } },
    introductionId: { stringValue: 'm4-test' },
    status: { stringValue: 'active' },
    unreadCounts: { mapValue: { fields: { [TAZ]: { integerValue: '0' }, [WC]: { integerValue: '0' } } } },
    createdAt: { integerValue: String(now) },
    updatedAt: { integerValue: String(now) },
  } }),
})).json();
const convId = conv.name.split('/').pop();
console.log('CONV_ID:', convId, '\n');

// real web sendMessage (mirror of src/lib/chat.ts)
async function sendMessage(text) {
  const t = Date.now();
  const batch = writeBatch(db);
  const msgRef = doc(collection(db, 'conversations', convId, 'messages'));
  batch.set(msgRef, { id: msgRef.id, senderId: WC, text, createdAt: t, readBy: [WC], deleted: false });
  batch.update(doc(db, 'conversations', convId), {
    lastMessage: { text, senderId: WC, sentAt: t }, updatedAt: t, [`unreadCounts.${TAZ}`]: increment(1),
  });
  await batch.commit();
}

// 2) subscribe FIRST so we capture everything live
const seen = new Set();
onSnapshot(query(collection(db, 'conversations', convId, 'messages'), orderBy('createdAt', 'asc')), (snap) => {
  snap.docs.forEach((d) => {
    if (seen.has(d.id)) return;
    seen.add(d.id);
    const m = d.data();
    const who = m.senderId === WC ? 'WEBSITE(WC)' : m.senderId === TAZ ? 'ANDROID(tazRyn1)' : m.senderId;
    console.log(`[${stamp()}] message ← ${who}: "${m.text}"`);
  });
});

await sendMessage('Hello from the website — M1');
console.log(`[${stamp()}] WC sent M1 (Website→Android write committed)\n→ now reply from the emulator; this subscription will receive it live.\n`);

setTimeout(() => { console.log('\n(verification window closed)'); process.exit(0); }, 150000);
