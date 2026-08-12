import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminFirestore, FirebaseAdminConfigError } from '@/lib/server/firebaseAdmin';
import {
  resolveAdminAccountRequest,
  type ServerAdminRecord,
} from '@/lib/server/adminAccountService';

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

export async function GET(
  request: Request,
  context: { params: Promise<{ uid: string }> },
) {
  try {
    const { uid } = await context.params;
    const firestore = adminFirestore();
    const auth = adminAuth();

    const result = await resolveAdminAccountRequest(
      request.headers.get('authorization'),
      uid,
      {
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
        getUserRecord: async (targetUid) => {
          try {
            return await auth.getUser(targetUid);
          } catch (error) {
            const err = error as { code?: string };
            if (err.code === 'auth/user-not-found') return null;
            throw error;
          }
        },
        writeAuditLog: async ({ adminUid, targetUid, action }) => {
          await firestore.collection('adminAuditLogs').add({
            adminUid,
            targetUid,
            action,
            source: 'admin_api',
            createdAt: FieldValue.serverTimestamp(),
          });
        },
      },
    );

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof FirebaseAdminConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    const err = error as { code?: string; message?: string };
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
