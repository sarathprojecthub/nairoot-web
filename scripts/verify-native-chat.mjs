// Stability milestone: live Android↔Website chat over the NATIVE Android stack.
//   node --env-file=.env.local scripts/verify-native-chat.mjs
// Sets up a web user WX *with a profile* (so the conversation renders on Android),
// a conversation with the emulator account, a seed message, and a live subscription.
// Then drive the emulator: open the chat, read the seed (Website→Android), reply
// (real native Android send) → this subscription receives it live (Android→Website).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, doc, query, orderBy, onSnapshot, writeBatch, increment } from 'firebase/firestore';

const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const TAZ = 'tazRyn1WuOTzgEqXiECey2hPXSM2';
const REST = 'https://firestore.googleapis.com/v1/projects/nairoot-app/databases/(default)/documents';
const ts = () => new Date().toLocaleTimeString();

async function token() {
  const c = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'));
  return (await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com', client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi', refresh_token: c.tokens.refresh_token, grant_type: 'refresh_token' }) })).json()).access_token;
}
async function adminPut(T, docPath, fields) {
  await fetch(`${REST}/${docPath}`, { method: 'PATCH', headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
}

const app = initializeApp(cfg);
const db = getFirestore(app);
const WX = (await signInAnonymously(getAuth(app))).user.uid;
const T = await token();
console.log('web user WX:', WX, '| android:', TAZ, '\n');

// give WX a profile so the conversation renders on Android
const now = Date.now();
await adminPut(T, `profiles/${WX}`, {
  uid: { stringValue: WX }, name: { stringValue: 'Web Tester' }, age: { integerValue: '30' },
  city: { stringValue: 'Kochi' }, profession: { stringValue: 'Designer' }, gender: { stringValue: 'female' },
  isVisible: { booleanValue: true }, createdAt: { integerValue: String(now) }, updatedAt: { integerValue: String(now) },
});
// conversation [TAZ, WX]
const convRes = await (await fetch(`${REST}/conversations`, { method: 'POST', headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: {
  participants: { arrayValue: { values: [{ stringValue: TAZ }, { stringValue: WX }] } },
  introductionId: { stringValue: 'stability' }, status: { stringValue: 'active' },
  unreadCounts: { mapValue: { fields: { [TAZ]: { integerValue: '0' }, [WX]: { integerValue: '0' } } } },
  createdAt: { integerValue: String(now) }, updatedAt: { integerValue: String(now) },
} }) })).json();
const convId = convRes.name.split('/').pop();
console.log('CONV_ID:', convId, '\n');

// WX seed message (real web sendMessage)
async function webSend(text) {
  const t = Date.now();
  const b = writeBatch(db);
  const m = doc(collection(db, 'conversations', convId, 'messages'));
  b.set(m, { id: m.id, senderId: WX, text, createdAt: t, readBy: [WX], deleted: false });
  b.update(doc(db, 'conversations', convId), { lastMessage: { text, senderId: WX, sentAt: t }, updatedAt: t, [`unreadCounts.${TAZ}`]: increment(1) });
  await b.commit();
}

const seen = new Set();
onSnapshot(query(collection(db, 'conversations', convId, 'messages'), orderBy('createdAt', 'asc')), (snap) => {
  snap.docs.forEach((d) => {
    if (seen.has(d.id)) return;
    seen.add(d.id);
    const m = d.data();
    const from = m.senderId === TAZ ? 'ANDROID(native)' : 'WEBSITE(WX)';
    console.log(`[${ts()}] WX received ← ${from}: "${m.text}"`);
  });
});

await webSend('Hi from the website — open me on Android');
console.log(`[${ts()}] seed sent.\n→ On the emulator: open Chats → "Web Tester" → reply. This will receive it live.\n`);

setTimeout(() => { console.log('\n(window closed)'); process.exit(0); }, 180000);
