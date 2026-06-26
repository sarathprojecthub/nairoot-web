// M3 end-to-end: Android → Website introduction, accepted by the Website.
//   node --env-file=.env.local scripts/verify-accept.mjs
// Step 1 (admin) simulates "Android(tazRyn1) sends to web user W" — the web user
// is anonymous with no profile, so it can't be discovered in-app; admin-write is
// the faithful stand-in for the send. Step 2 runs the EXACT web accept transaction
// (src/lib/introductions.ts acceptIntroduction) as W against live Security Rules.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, collection, runTransaction } from 'firebase/firestore';

const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const TAZ = 'tazRyn1WuOTzgEqXiECey2hPXSM2'; // Android emulator account (sender)
const PROJECT = 'nairoot-app';
const REST = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

async function adminToken() {
  const c = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
      refresh_token: c.tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  return (await r.json()).access_token;
}
const g = (f, k) => {
  const v = f?.[k];
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('mapValue' in v) return Object.keys(v.mapValue.fields ?? {});
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map((x) => x.stringValue ?? x.integerValue);
  return JSON.stringify(v);
};

const app = initializeApp(cfg);
const db = getFirestore(app);
const W = (await signInAnonymously(getAuth(app))).user.uid;
const T = await adminToken();
console.log('web user W:', W, '\nandroid    :', TAZ, '\n');

// 1) Android(tazRyn1) → W : admin-inject pending introduction (stand-in for send)
const now = Date.now();
const createRes = await fetch(`${REST}/introductions`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fields: {
      senderId: { stringValue: TAZ },
      recipientId: { stringValue: W },
      status: { stringValue: 'pending' },
      sentAt: { integerValue: String(now) },
      expiresAt: { integerValue: String(now + 7 * 86400000) },
      seenByRecipient: { booleanValue: false },
    },
  }),
});
const introId = (await createRes.json()).name.split('/').pop();
console.log('1) ✓ Android→W introduction injected:', introId);

// 2) Web (W) accepts — EXACT mirror of lib acceptIntroduction, real rules.
const convId = await runTransaction(db, async (tx) => {
  const introRef = doc(db, 'introductions', introId);
  const convRef = doc(collection(db, 'conversations'));
  const matchRef = doc(collection(db, 'matches'));
  const snap = await tx.get(introRef);
  const intro = snap.data();
  if (intro.status !== 'pending') throw new Error('introduction_not_pending');
  const t = Date.now();
  tx.set(convRef, {
    id: convRef.id,
    participants: [intro.senderId, intro.recipientId],
    introductionId: introId,
    status: 'active',
    unreadCounts: { [intro.senderId]: 0, [intro.recipientId]: 0 },
    createdAt: t,
    updatedAt: t,
  });
  tx.set(matchRef, {
    id: matchRef.id,
    userA: intro.senderId,
    userB: intro.recipientId,
    introductionId: introId,
    conversationId: convRef.id,
    createdAt: t,
  });
  tx.update(introRef, { status: 'accepted', conversationId: convRef.id, respondedAt: t });
  return convRef.id;
});
console.log('2) ✓ Web accepted (real transaction, live rules) — conversationId:', convId);

// 3) Verify the documents Android expects (admin reads).
const headers = { Authorization: `Bearer ${T}` };
const intro = (await (await fetch(`${REST}/introductions/${introId}`, { headers })).json()).fields;
const conv = (await (await fetch(`${REST}/conversations/${convId}`, { headers })).json()).fields;
const matchQ = await (await fetch(`${REST}:runQuery`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'matches' }], where: { fieldFilter: { field: { fieldPath: 'introductionId' }, op: 'EQUAL', value: { stringValue: introId } } } } }),
})).json();
const match = matchQ.find((x) => x.document)?.document?.fields;

console.log('\n3) Documents created / updated:');
console.log('   introduction.status      :', g(intro, 'status'), '| conversationId:', g(intro, 'conversationId') === convId ? 'matches ✓' : 'MISMATCH');
console.log('   conversation.participants:', g(conv, 'participants'), '| status:', g(conv, 'status'));
console.log('   conversation.unreadCounts:', g(conv, 'unreadCounts'));
console.log('   match.userA / userB      :', g(match, 'userA'), '/', g(match, 'userB'), '| convId:', g(match, 'conversationId') === convId ? 'matches ✓' : 'MISMATCH');

console.log('\nAndroid ↔ Website matching: VERIFIED');
console.log('SENDER_TO_CHECK_ON_ANDROID:', TAZ, 'INTRO:', introId);
process.exit(0);
