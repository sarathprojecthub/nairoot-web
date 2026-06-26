// Final regression setup for the RNFirebase conversation migration.
//   node --env-file=.env.local scripts/final-regression.mjs
// Creates two renderable conversations for the emulator (tazRyn1):
//   C_WEB : [tazRyn1, WF]   WF = profiled web user      → Android↔Website
//   C_AND : [tazRyn1, PEER] PEER = real Android profile  → Android↔Android
// Seeds each, keeps a LIVE subscription on C_WEB so a native Android reply is
// received live (Android→Website). Reply into C_AND is an Android↔Android send.
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
const PEER = 'EPIwuyQNySg7Cl8WAqYHEbNlVjA2'; // an existing real onboarded Android profile
const REST = 'https://firestore.googleapis.com/v1/projects/nairoot-app/databases/(default)/documents';
const ts = () => new Date().toLocaleTimeString();

async function token() {
  const c = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'));
  return (await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com', client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi', refresh_token: c.tokens.refresh_token, grant_type: 'refresh_token' }) })).json()).access_token;
}
async function makeConv(T, parts) {
  const now = Date.now();
  const r = await (await fetch(`${REST}/conversations`, { method: 'POST', headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: {
    participants: { arrayValue: { values: parts.map((p) => ({ stringValue: p })) } },
    introductionId: { stringValue: 'final-reg' }, status: { stringValue: 'active' },
    unreadCounts: { mapValue: { fields: Object.fromEntries(parts.map((p) => [p, { integerValue: '0' }])) } },
    createdAt: { integerValue: String(now) }, updatedAt: { integerValue: String(now) },
  } }) })).json();
  return r.name.split('/').pop();
}
async function adminMsg(T, convId, sender, text) {
  const t = Date.now();
  await fetch(`${REST}/conversations/${convId}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { senderId: { stringValue: sender }, text: { stringValue: text }, createdAt: { integerValue: String(t) }, readBy: { arrayValue: { values: [{ stringValue: sender }] } }, deleted: { booleanValue: false } } }) });
  await fetch(`${REST}/conversations/${convId}?updateMask.fieldPaths=lastMessage&updateMask.fieldPaths=updatedAt`, { method: 'PATCH', headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { lastMessage: { mapValue: { fields: { text: { stringValue: text }, senderId: { stringValue: sender }, sentAt: { integerValue: String(t) } } } }, updatedAt: { integerValue: String(t) } } }) });
}

const app = initializeApp(cfg);
const db = getFirestore(app);
const WF = (await signInAnonymously(getAuth(app))).user.uid;
const T = await token();
const now = Date.now();

// profile for WF so C_WEB renders on Android
await fetch(`${REST}/profiles/${WF}`, { method: 'PATCH', headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { uid: { stringValue: WF }, name: { stringValue: 'WF Web' }, age: { integerValue: '29' }, city: { stringValue: 'Kochi' }, profession: { stringValue: 'Writer' }, gender: { stringValue: 'female' }, isVisible: { booleanValue: false }, createdAt: { integerValue: String(now) }, updatedAt: { integerValue: String(now) } } }) });

const C_WEB = await makeConv(T, [TAZ, WF]);
const C_AND = await makeConv(T, [TAZ, PEER]);
console.log('WF:', WF, '\nC_WEB:', C_WEB, '| C_AND:', C_AND, '\n');

// seed C_WEB via real web sendMessage
const t0 = Date.now();
const b = writeBatch(db);
const m = doc(collection(db, 'conversations', C_WEB, 'messages'));
b.set(m, { id: m.id, senderId: WF, text: 'Web → Android (final check)', createdAt: t0, readBy: [WF], deleted: false });
b.update(doc(db, 'conversations', C_WEB), { lastMessage: { text: 'Web → Android (final check)', senderId: WF, sentAt: t0 }, updatedAt: t0, [`unreadCounts.${TAZ}`]: increment(1) });
await b.commit();
// seed C_AND authored as the Android peer (stand-in for the 2nd Android device)
await adminMsg(T, C_AND, PEER, 'Android peer → tazRyn1 (final check)');

// live subscription on C_WEB to catch the native Android reply
const seen = new Set();
onSnapshot(query(collection(db, 'conversations', C_WEB, 'messages'), orderBy('createdAt', 'asc')), (snap) => {
  snap.docs.forEach((d) => { if (seen.has(d.id)) return; seen.add(d.id); const x = d.data(); console.log(`[${ts()}] C_WEB ← ${x.senderId === TAZ ? 'ANDROID(native)' : 'WEB'}: "${x.text}"`); });
});

console.log('Ready. On the emulator: Discover, Introductions, then Chats →');
console.log('  • open "EPIwuyQN…" → reply  (Android↔Android)');
console.log('  • open "WF Web" → reply      (Android↔Website, captured live below)\n');
setTimeout(() => { console.log('\n(window closed)'); process.exit(0); }, 300000);
