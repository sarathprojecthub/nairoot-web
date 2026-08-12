export interface SignupBootstrapExtra {
  phoneVerified?: boolean;
  phoneCountryCode?: string;
  policyAcceptedVersion?: number;
}

export interface SignupBootstrapDeps<AuthUser> {
  createAuthUser: () => Promise<{ user: AuthUser }>;
  createUserDoc: (uid: string, phone: string, extra?: SignupBootstrapExtra) => Promise<void>;
  signOut: () => Promise<void>;
  getUid: (user: AuthUser) => string;
}

export interface SignInBootstrapDeps<AuthUser> {
  signIn: () => Promise<{ user: AuthUser }>;
  createUserDoc: (uid: string, phone: string) => Promise<void>;
  getUid: (user: AuthUser) => string;
}

export interface MissingBootstrapRepairDeps {
  createUserDoc: (uid: string, phone: string) => Promise<void>;
}

export async function completeSignupBootstrap<AuthUser>(
  deps: SignupBootstrapDeps<AuthUser>,
  phone: string,
  extra?: SignupBootstrapExtra,
): Promise<{ uid: string }> {
  const created = await deps.createAuthUser();
  const uid = deps.getUid(created.user);
  try {
    await deps.createUserDoc(uid, phone, extra);
  } catch (error) {
    try {
      await deps.signOut();
    } catch {
      // Best effort only; preserve the original bootstrap error so the
      // account can be recovered later by signing in again.
    }
    throw error;
  }
  return { uid };
}

export async function completeSignInBootstrap<AuthUser>(
  deps: SignInBootstrapDeps<AuthUser>,
): Promise<{ uid: string }> {
  const signedIn = await deps.signIn();
  const uid = deps.getUid(signedIn.user);
  await deps.createUserDoc(uid, '');
  return { uid };
}

export async function repairMissingBootstrapUserDoc(
  deps: MissingBootstrapRepairDeps,
  options: {
    uid: string;
    hasUserDoc: boolean;
    authMutationPending: boolean;
    repairAttempted: boolean;
  },
): Promise<boolean> {
  if (options.hasUserDoc || options.authMutationPending || options.repairAttempted) {
    return false;
  }

  await deps.createUserDoc(options.uid, '');
  return true;
}
