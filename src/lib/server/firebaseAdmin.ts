import 'server-only';

import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export class FirebaseAdminConfigError extends Error {}

function getProjectId(): string {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new FirebaseAdminConfigError(
      'Firebase Admin is not configured. Set FIREBASE_ADMIN_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID.',
    );
  }
  return projectId;
}

function getPrivateKey(): string | null {
  const raw = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!raw) return null;
  return raw.replace(/\\n/g, '\n');
}

function getClientEmail(): string | null {
  return process.env.FIREBASE_ADMIN_CLIENT_EMAIL ?? null;
}

function ensureAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  const projectId = getProjectId();
  const clientEmail = getClientEmail();
  const privateKey = getPrivateKey();

  if (clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  }

  throw new FirebaseAdminConfigError(
    'Firebase Admin credentials are not configured. Set FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY for Vercel, or GOOGLE_APPLICATION_CREDENTIALS for local/server ADC.',
  );
}

export function adminAuth() {
  return getAuth(ensureAdminApp());
}

export function adminFirestore() {
  return getFirestore(ensureAdminApp());
}

