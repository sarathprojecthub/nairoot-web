import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminFirestore, FirebaseAdminConfigError } from '@/lib/server/firebaseAdmin';
import {
  resolveAdminDirectoryRequest,
  type ResolveAdminDirectoryDeps,
  type ServerAdminRecord,
} from '@/lib/server/adminDirectoryService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mapAdminRecord(
  uid: string,
  data: Record<string, unknown> | undefined,
): ServerAdminRecord | null {
  if (!data || data.active !== true) return null;
  return {
    uid,
    email: typeof data.email === 'string' ? data.email : null,
    role: typeof data.role === 'string' ? data.role : null,
    active: true,
    permissions: typeof data.permissions === 'object' && data.permissions
      ? (data.permissions as ServerAdminRecord['permissions'])
      : {},
  };
}

async function getDocsByUids(
  collectionName: 'users' | 'profiles',
  uids: string[],
) {
  if (uids.length === 0) return [];
  const firestore = adminFirestore();
  const refs = uids.map((uid) => firestore.collection(collectionName).doc(uid));
  const docs = await firestore.getAll(...refs);
  return docs.filter((doc) => doc.exists).map((doc) => ({
    id: doc.id,
    data: (doc.data() ?? {}) as Record<string, unknown>,
  }));
}

async function listRecentFirestoreDocs(
  collectionName: 'users' | 'profiles',
  pageSize: number,
) {
  const firestore = adminFirestore();
  const attempts: Array<() => Promise<FirebaseFirestore.QuerySnapshot>> = [
    () => firestore.collection(collectionName).orderBy('updatedAt', 'desc').limit(pageSize).get(),
    () => firestore.collection(collectionName).orderBy('createdAt', 'desc').limit(pageSize).get(),
    () => firestore.collection(collectionName).limit(pageSize).get(),
  ];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      const snap = await attempt();
      return snap.docs.map((doc) => ({
        id: doc.id,
        data: (doc.data() ?? {}) as Record<string, unknown>,
      }));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to list ${collectionName}.`);
}

function buildDeps(): ResolveAdminDirectoryDeps {
  const auth = adminAuth();
  const firestore = adminFirestore();

  return {
    verifyIdToken: async (token) => {
      const decoded = await auth.verifyIdToken(token);
      return {
        uid: decoded.uid,
        email: typeof decoded.email === 'string' ? decoded.email : null,
      };
    },
    getAdminRecord: async (adminUid) => {
      const snap = await firestore.collection('admins').doc(adminUid).get();
      return mapAdminRecord(adminUid, snap.data() as Record<string, unknown> | undefined);
    },
    listAuthUsers: async (pageSize, pageToken) => {
      const result = await auth.listUsers(pageSize, pageToken);
      return {
        users: result.users.map((user) => ({
          uid: user.uid,
          email: user.email ?? null,
          phoneNumber: user.phoneNumber ?? null,
          disabled: user.disabled,
          metadata: {
            creationTime: user.metadata.creationTime ?? null,
          },
        })),
        pageToken: result.pageToken,
      };
    },
    getAuthUserByUid: async (uid) => {
      try {
        const user = await auth.getUser(uid);
        return {
          uid: user.uid,
          email: user.email ?? null,
          phoneNumber: user.phoneNumber ?? null,
          disabled: user.disabled,
          metadata: {
            creationTime: user.metadata.creationTime ?? null,
          },
        };
      } catch (error) {
        const err = error as { code?: string };
        if (err.code === 'auth/user-not-found') return null;
        throw error;
      }
    },
    getAuthUserByEmail: async (email) => {
      try {
        const user = await auth.getUserByEmail(email);
        return {
          uid: user.uid,
          email: user.email ?? null,
          phoneNumber: user.phoneNumber ?? null,
          disabled: user.disabled,
          metadata: {
            creationTime: user.metadata.creationTime ?? null,
          },
        };
      } catch (error) {
        const err = error as { code?: string };
        if (err.code === 'auth/user-not-found') return null;
        throw error;
      }
    },
    getAuthUserByPhone: async (phone) => {
      try {
        const user = await auth.getUserByPhoneNumber(phone);
        return {
          uid: user.uid,
          email: user.email ?? null,
          phoneNumber: user.phoneNumber ?? null,
          disabled: user.disabled,
          metadata: {
            creationTime: user.metadata.creationTime ?? null,
          },
        };
      } catch (error) {
        const err = error as { code?: string };
        if (err.code === 'auth/user-not-found') return null;
        throw error;
      }
    },
    getDocsByUids,
    listRecentFirestoreDocs,
    getFirestoreDocById: async (collectionName, uid) => {
      const snap = await firestore.collection(collectionName).doc(uid).get();
      if (!snap.exists) return null;
      return {
        id: snap.id,
        data: (snap.data() ?? {}) as Record<string, unknown>,
      };
    },
    writeAuditLog: async ({ adminUid, action }) => {
      await firestore.collection('adminAuditLogs').add({
        adminUid,
        action,
        source: 'admin_api',
        createdAt: FieldValue.serverTimestamp(),
      });
    },
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const result = await resolveAdminDirectoryRequest(
      {
        authHeader: request.headers.get('authorization'),
        pageToken: url.searchParams.get('pageToken'),
        pageSize: url.searchParams.get('pageSize') ? Number(url.searchParams.get('pageSize')) : null,
        filter: url.searchParams.get('filter'),
        uid: url.searchParams.get('uid'),
        email: url.searchParams.get('email'),
        phone: url.searchParams.get('phone'),
      },
      buildDeps(),
    );

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof FirebaseAdminConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    const err = error as { code?: string };
    if (
      err.code === 'auth/argument-error'
      || err.code === 'auth/id-token-expired'
      || err.code === 'auth/invalid-id-token'
    ) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error.' },
      { status: 500 },
    );
  }
}
