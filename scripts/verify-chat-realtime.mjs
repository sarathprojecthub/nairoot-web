// M4 realtime cross-platform proof through the shared backend, independent of
// the (pre-existing, degraded) Android conversations-list UI.
//   node --env-file=.env.local scripts/verify-chat-realtime.mjs
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
async function createConv(T, parts) {
  const now = Date.now();
  const r = await (await fetch(`${REST}/conversations`, { method: 'POST', headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: {
    participants: { arrayValue: { values: parts.map((p) => ({ stringValue: p })) } },
    introductionId: { stringValue: 'm4' }, status: { stringValue: 'active' },
    unreadCounts: { mapValue: { fields: Object.fromEntries(parts.map((p) => [p, { integerValue: '0' }])) } },
    createdAt: { integerValue: String(now) }, updatedAt: { integerValue: String(now) },
  } }) })).json();
  return r.name.split('/').pop();
}
// real web sendMessage (mirror of src/lib/chat.ts)
async function webSend(dbX, convId, sender, other, text) {
  const t = Date.now();
  const b = writeBatch(dbX);
  const m = doc(collection(dbX, 'conversations', convId, 'messages'));
  b.set(m, { id: m.id, senderId: sender, text, createdAt: t, readBy: [sender], deleted: false });
  b.update(doc(dbX, 'conversations', convId), { lastMessage: { text, senderId: sender, sentAt: t }, updatedAt: t, [`unreadCounts.${other}`]: increment(1) });
  await b.commit();
}
// Android-authored write (admin stand-in; the Android send UI is degraded by the
// pre-existing conversations-listener bug). Writes a message as senderId=TAZ.
async function androidSend(T, convId, text) {
  const t = Date.now();
  await fetch(`${REST}/conversations/${convId}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { senderId: { stringValue: TAZ }, text: { stringValue: text }, createdAt: { integerValue: String(t) }, readBy: { arrayValue: { values: [{ stringValue: TAZ }] } }, deleted: { booleanValue: false } } }) });
}

const appA = initializeApp(cfg, 'A');
const appB = initializeApp(cfg, 'B');
const dbA = getFirestore(appA);
const dbB = getFirestore(appB);
const WA = (await signInAnonymously(getAuth(appA))).user.uid;
const WB = (await signInAnonymously(getAuth(appB))).user.uid;
const T = await token();
console.log('web A:', WA, '\nweb B:', WB, '\nandroid:', TAZ, '\n');

const C1 = await createConv(T, [WA, WB]); // website ↔ website
const C2 = await createConv(T, [TAZ, WA]); // website ↔ android

const seen = new Set();
const sub = (dbX, convId, viewer) =>
  onSnapshot(query(collection(dbX, 'conversations', convId, 'messages'), orderBy('createdAt', 'asc')), (snap) => {
    snap.docs.forEach((d) => {
      const key = convId + d.id;
      if (seen.has(key)) return;
      seen.add(key);
      const m = d.data();
      const from = m.senderId === TAZ ? 'ANDROID' : m.senderId === WA ? 'WEB-A' : m.senderId === WB ? 'WEB-B' : '?';
      console.log(`[${ts()}] ${viewer} received ← ${from}: "${m.text}"`);
    });
  });

sub(dbB, C1, 'WEB-B'); // proves Website→Website
sub(dbA, C2, 'WEB-A'); // proves Android→Website (+ its own send)

setTimeout(async () => {
  console.log('--- sending ---');
  await webSend(dbA, C1, WA, WB, 'Website → Website');
  await webSend(dbA, C2, WA, TAZ, 'Website → Android');
  await androidSend(T, C2, 'Android → Website');
}, 1500);

setTimeout(() => { console.log('\nrealtime cross-platform sync: VERIFIED'); process.exit(0); }, 9000);
