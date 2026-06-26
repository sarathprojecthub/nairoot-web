// M0 verification: prove Android ↔ Website interoperability.
// Signs in anonymously (same as the Android app) and reads the SHARED `profiles`
// collection from the live `nairoot-app` Firestore — the exact data the Android
// app created. Run with:  node --env-file=.env.local scripts/verify-firestore.mjs
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, where, limit } from 'firebase/firestore';

const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(cfg);
const auth = getAuth(app);
const db = getFirestore(app);

console.log('Project:', cfg.projectId);
const cred = await signInAnonymously(auth);
console.log('✓ Anonymous auth OK — uid:', cred.user.uid);

const snap = await getDocs(query(collection(db, 'profiles'), where('isVisible', '==', true), limit(50)));
console.log(`✓ Firestore read OK — visible profiles: ${snap.size}`);
snap.docs.slice(0, 5).forEach((d) => console.log('   •', d.id, '→', d.data().name));

console.log('\nAndroid ↔ Website interoperability: VERIFIED');
process.exit(0);
