'use client';

import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '@/lib/firebase';

export type AdminPermission =
  | 'viewDashboard'
  | 'viewUsers'
  | 'viewProfiles'
  | 'manageProfiles'
  | 'viewConversations'
  | 'viewMessages'
  | 'viewWaitlist'
  | 'viewReports'
  | 'writeAuditLogs';

export interface AdminRecord {
  uid: string;
  email?: string;
  role?: string;
  active: boolean;
  permissions: Partial<Record<AdminPermission, boolean>>;
}

export interface AdminDebugInfo {
  currentUid: string;
  currentEmail: string | null;
  adminDocPath: string;
  getDocSucceeded: boolean;
  docExists: boolean | null;
  activeValue: unknown;
  roleValue: unknown;
  permissionChecked?: AdminPermission;
  firestoreErrorCode?: string;
  firestoreErrorMessage?: string;
}

export interface AdminDoc {
  id: string;
  data: Record<string, unknown>;
}

export interface AdminMessage extends AdminDoc {
  conversationId: string;
}

export interface ParticipantInfo {
  uid: string;
  displayName: string;
  email: string;
  photoUrl: string;
  initials: string;
  profileExists: boolean;
  userExists: boolean;
  profileStatus: string;
  moderationStatus: string;
}

export interface DashboardMetrics {
  users: number | null;
  profiles: number | null;
  visibleProfiles: number | null;
  completedProfiles: number | null;
  hiddenProfiles: number | null;
  underReviewProfiles: number | null;
  introductions: number | null;
  acceptedIntroductions: number | null;
  conversations: number | null;
  messages: number | null;
  waitlist: number | null;
  reports: number | null;
}

export interface AdminMember {
  uid: string;
  userDoc: AdminDoc | null;
  profileDoc: AdminDoc | null;
  displayName: string;
  email: string;
  phone: string;
  photoUrl: string;
  initials: string;
  isTestProfile: boolean;
  status: string;
  moderationStatus: string;
  isVisible: boolean | null;
  profileExists: boolean;
  userExists: boolean;
}

export interface MemberMirrorData {
  member: AdminMember;
  introductionsSent: AdminDoc[];
  introductionsReceived: AdminDoc[];
  acceptedIntroductions: AdminDoc[];
  conversations: AdminDoc[];
  messagesByConversation: Record<string, AdminDoc[]>;
  profileViewsSent: AdminDoc[];
  profileViewsReceived: AdminDoc[];
  notifications: AdminDoc[];
  reportsByUser: AdminDoc[];
  reportsAgainstUser: AdminDoc[];
  waitlist: AdminDoc | null;
  auditLogs: AdminDoc[];
  sectionErrors: Record<string, string>;
}

export interface AdminSearchResult {
  type: 'member' | 'conversation';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export const ADMIN_PAGE_LIMIT = 50;
export const MESSAGE_PAGE_LIMIT = 100;

export const ACCESS_REASONS = [
  'Trust & safety review',
  'User support',
  'Abuse report',
  'Technical troubleshooting',
  'Founder review',
  'Other',
] as const;

export function hasPermission(admin: AdminRecord | null, permission: AdminPermission): boolean {
  return Boolean(admin?.active && admin.permissions?.[permission]);
}

export async function fetchAdminRecord(user: User): Promise<AdminRecord | null> {
  const snap = await getDoc(adminRefForUser(user));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (data.active !== true) return null;
  return {
    uid: user.uid,
    email: typeof data.email === 'string' ? data.email : user.email ?? undefined,
    role: typeof data.role === 'string' ? data.role : 'admin',
    active: true,
    permissions: (data.permissions ?? {}) as Partial<Record<AdminPermission, boolean>>,
  };
}

export function adminRefForUser(user: User) {
  return doc(db, 'admins', user.uid);
}

export function adminDocPathForUid(uid: string): string {
  return `admins/${uid}`;
}

export async function checkAdminRecord(
  user: User,
  permissionChecked?: AdminPermission,
): Promise<{ record: AdminRecord | null; debug: AdminDebugInfo }> {
  const debug: AdminDebugInfo = {
    currentUid: user.uid,
    currentEmail: user.email,
    adminDocPath: adminDocPathForUid(user.uid),
    getDocSucceeded: false,
    docExists: null,
    activeValue: undefined,
    roleValue: undefined,
    permissionChecked,
  };

  try {
    const snap = await getDoc(adminRefForUser(user));
    debug.getDocSucceeded = true;
    debug.docExists = snap.exists();

    if (!snap.exists()) return { record: null, debug };

    const data = snap.data();
    debug.activeValue = data.active;
    debug.roleValue = data.role;

    if (data.active !== true) return { record: null, debug };

    return {
      record: {
        uid: user.uid,
        email: typeof data.email === 'string' ? data.email : user.email ?? undefined,
        role: typeof data.role === 'string' ? data.role : 'admin',
        active: true,
        permissions: (data.permissions ?? {}) as Partial<Record<AdminPermission, boolean>>,
      },
      debug,
    };
  } catch (error) {
    const err = error as { code?: string; message?: string };
    debug.firestoreErrorCode = err.code;
    debug.firestoreErrorMessage = err.message;
    return { record: null, debug };
  }
}

export async function fetchCollectionDocs(
  collectionName: string,
  pageLimit = ADMIN_PAGE_LIMIT,
  preferredOrderFields: string[] = ['updatedAt', 'createdAt'],
): Promise<AdminDoc[]> {
  const ref = collection(db, collectionName);
  let lastError: unknown = null;

  for (const field of preferredOrderFields) {
    try {
      const snap = await getDocs(query(ref, orderBy(field, 'desc'), limit(pageLimit)));
      return snap.docs.map(docToAdminDoc);
    } catch (error) {
      lastError = error;
    }
  }

  try {
    const snap = await getDocs(query(ref, limit(pageLimit)));
    return snap.docs.map(docToAdminDoc);
  } catch (error) {
    throw lastError ?? error;
  }
}

export async function fetchConversation(conversationId: string): Promise<AdminDoc | null> {
  return fetchDocument('conversations', conversationId);
}

export async function fetchDocument(collectionName: string, id: string): Promise<AdminDoc | null> {
  const snap = await getDoc(doc(db, collectionName, id));
  if (!snap.exists()) return null;
  return { id: snap.id, data: snap.data() as Record<string, unknown> };
}

export async function fetchConversationMessages(conversationId: string): Promise<AdminDoc[]> {
  const ref = collection(db, 'conversations', conversationId, 'messages');
  try {
    const snap = await getDocs(query(ref, orderBy('createdAt', 'asc'), limit(MESSAGE_PAGE_LIMIT)));
    return snap.docs.map(docToAdminDoc);
  } catch {
    const snap = await getDocs(query(ref, limit(MESSAGE_PAGE_LIMIT)));
    return snap.docs
      .map(docToAdminDoc)
      .sort((a, b) => toMillis(a.data.createdAt) - toMillis(b.data.createdAt));
  }
}

export async function fetchRecentMessages(): Promise<AdminMessage[]> {
  try {
    const snap = await getDocs(query(collectionGroup(db, 'messages'), orderBy('createdAt', 'desc'), limit(MESSAGE_PAGE_LIMIT)));
    return snap.docs.map((messageSnap) => ({
      ...docToAdminDoc(messageSnap),
      conversationId: messageSnap.ref.parent.parent?.id ?? 'unknown',
    }));
  } catch {
    const conversations = await fetchCollectionDocs('conversations', 25, ['updatedAt', 'createdAt']);
    const nested = await Promise.all(
      conversations.map(async (conversation) => {
        const messages = await fetchConversationMessages(conversation.id);
        return messages.slice(-5).map((message) => ({ ...message, conversationId: conversation.id }));
      }),
    );
    return nested.flat().sort((a, b) => toMillis(b.data.createdAt) - toMillis(a.data.createdAt)).slice(0, MESSAGE_PAGE_LIMIT);
  }
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const [
    users,
    profiles,
    introductions,
    conversations,
    waitlist,
    reports,
    messages,
  ] = await Promise.all([
    safeCount('users'),
    safeCount('profiles'),
    safeCount('introductions'),
    safeCount('conversations'),
    safeCount('premiumWaitlist'),
    safeCount('reports'),
    safeCollectionGroupCount('messages'),
  ]);

  const profileDocs = await fetchCollectionDocs('profiles', 200, ['updatedAt', 'createdAt']).catch(() => []);
  const introDocs = await fetchCollectionDocs('introductions', 200, ['updatedAt', 'createdAt', 'sentAt']).catch(() => []);

  return {
    users,
    profiles,
    visibleProfiles: profileDocs.filter((p) => p.data.isVisible !== false && p.data.moderationStatus !== 'hidden').length,
    completedProfiles: profileDocs.filter((p) => Boolean(p.data.completed || p.data.isComplete || p.data.profileCompleted)).length,
    hiddenProfiles: profileDocs.filter((p) => p.data.moderationStatus === 'hidden' || p.data.isVisible === false).length,
    underReviewProfiles: profileDocs.filter((p) => p.data.moderationStatus === 'under_review').length,
    introductions,
    acceptedIntroductions: introDocs.filter((intro) => ['accepted', 'matched', 'match'].includes(formatValue(intro.data.status).toLowerCase())).length,
    conversations,
    messages,
    waitlist,
    reports,
  };
}

export async function resolveAdminMember(uid: string): Promise<AdminMember> {
  const [userDoc, profileDoc] = await Promise.all([
    fetchDocument('users', uid).catch(() => null),
    fetchDocument('profiles', uid).catch(() => null),
  ]);

  const profile = profileDoc?.data ?? {};
  const user = userDoc?.data ?? {};
  const displayName =
    getString(profile, ['name', 'fullName', 'displayName']) ||
    getString(user, ['name', 'fullName', 'displayName']) ||
    shortId(uid);
  const email = getString(user, ['email']) || getString(profile, ['email']);
  const phone = getString(user, ['phone', 'phoneNumber']) || getString(profile, ['phone', 'phoneNumber']);
  const photoUrl =
    getString(profile, ['photoUrl', 'profilePhoto', 'photo']) ||
    (Array.isArray(profile.photos) && typeof profile.photos[0] === 'string' ? profile.photos[0] : '');
  const isVisible = typeof profile.isVisible === 'boolean' ? profile.isVisible : null;

  return {
    uid,
    userDoc,
    profileDoc,
    displayName,
    email,
    phone,
    photoUrl,
    initials: initialsFor(displayName),
    isTestProfile: user.isTestProfile === true || profile.isTestProfile === true,
    status: formatValue(profile.status ?? profile.profileStatus ?? user.status ?? user.onboardingStatus),
    moderationStatus: formatValue(profile.moderationStatus ?? (isVisible === false ? 'hidden' : 'visible')),
    isVisible,
    profileExists: Boolean(profileDoc),
    userExists: Boolean(userDoc),
  };
}

export async function loadMemberMirror(uid: string): Promise<MemberMirrorData> {
  const sectionErrors: Record<string, string> = {};
  const member = await resolveAdminMember(uid);

  const [
    introductionsSent,
    introductionsReceived,
    conversations,
    profileViewsSent,
    profileViewsReceived,
    notifications,
    reportsByUser,
    reportsAgainstUser,
    waitlist,
    auditLogs,
  ] = await Promise.all([
    safeQueryDocs('introductions', [where('senderId', '==', uid)], 'introductionsSent', sectionErrors),
    safeQueryDocs('introductions', [where('recipientId', '==', uid)], 'introductionsReceived', sectionErrors),
    safeQueryDocs('conversations', [where('participants', 'array-contains', uid)], 'conversations', sectionErrors),
    safeQueryDocs('profileViews', [where('viewerUid', '==', uid)], 'profileViewsSent', sectionErrors),
    safeQueryDocs('profileViews', [where('profileUid', '==', uid)], 'profileViewsReceived', sectionErrors),
    safeQueryDocs('notifications', [where('recipientUid', '==', uid)], 'notifications', sectionErrors),
    safeQueryDocs('reports', [where('reporterId', '==', uid)], 'reportsByUser', sectionErrors),
    safeQueryDocs('reports', [where('reportedUid', '==', uid)], 'reportsAgainstUser', sectionErrors),
    fetchDocument('premiumWaitlist', uid).catch((error) => {
      sectionErrors.waitlist = errorMessage(error);
      return null;
    }),
    safeQueryDocs('adminAuditLogs', [where('targetUid', '==', uid)], 'auditLogs', sectionErrors),
  ]);

  const messagesByConversation: Record<string, AdminDoc[]> = {};
  await Promise.all(
    conversations.slice(0, 25).map(async (conversation) => {
      try {
        messagesByConversation[conversation.id] = await fetchConversationMessages(conversation.id);
      } catch (error) {
        sectionErrors[`messages:${conversation.id}`] = errorMessage(error);
        messagesByConversation[conversation.id] = [];
      }
    }),
  );

  const acceptedIntroductions = [...introductionsSent, ...introductionsReceived].filter((intro) =>
    ['accepted', 'matched', 'match'].includes(formatValue(intro.data.status).toLowerCase()),
  );

  return {
    member,
    introductionsSent,
    introductionsReceived,
    acceptedIntroductions,
    conversations,
    messagesByConversation,
    profileViewsSent,
    profileViewsReceived,
    notifications,
    reportsByUser,
    reportsAgainstUser,
    waitlist,
    auditLogs,
    sectionErrors,
  };
}

export async function resolveAdminSearch(search: string): Promise<AdminSearchResult[]> {
  const term = search.trim();
  if (!term) return [];
  const lower = term.toLowerCase();
  const results: AdminSearchResult[] = [];

  const [directUser, directProfile, directConversation] = await Promise.all([
    fetchDocument('users', term).catch(() => null),
    fetchDocument('profiles', term).catch(() => null),
    fetchDocument('conversations', term).catch(() => null),
  ]);

  if (directUser || directProfile) {
    const member = await resolveAdminMember(term);
    results.push(memberSearchResult(member, 'Exact member found'));
  }

  if (directConversation) {
    results.push({
      type: 'conversation',
      id: directConversation.id,
      title: `Conversation ${shortId(directConversation.id)}`,
      subtitle: `Exact conversation found · ${participantUidsFromConversation(directConversation.data).map((uid) => shortId(uid)).join(' and ') || shortId(directConversation.id)}`,
      href: `/admin/conversations/${directConversation.id}`,
    });
  }

  try {
    const emailSnap = await getDocs(query(collection(db, 'users'), where('email', '==', term), limit(5)));
    for (const userSnap of emailSnap.docs) {
      if (!results.some((result) => result.type === 'member' && result.id === userSnap.id)) {
        results.push(memberSearchResult(await resolveAdminMember(userSnap.id), 'Exact email found'));
      }
    }
  } catch {
    // Email lookup is an enhancement; recent loaded fallback below still works when indexes/rules block it.
  }

  const [users, profiles] = await Promise.all([
    fetchCollectionDocs('users', 150, ['updatedAt', 'createdAt']).catch(() => []),
    fetchCollectionDocs('profiles', 150, ['updatedAt', 'createdAt']).catch(() => []),
  ]);

  const candidateUids = new Set<string>();
  users.forEach((doc) => {
    const haystack = [
      doc.id,
      doc.data.email,
      doc.data.phone,
      doc.data.phoneNumber,
      doc.data.name,
      doc.data.displayName,
      doc.data.matrimonyId,
      doc.data.memberId,
      doc.data.profileId,
    ].map(formatValue).join(' ').toLowerCase();
    if (haystack.includes(lower)) candidateUids.add(doc.id);
  });
  profiles.forEach((doc) => {
    const haystack = [
      doc.id,
      doc.data.name,
      doc.data.fullName,
      doc.data.city,
      doc.data.profession,
      doc.data.matrimonyId,
      doc.data.memberId,
      doc.data.profileId,
    ].map(formatValue).join(' ').toLowerCase();
    if (haystack.includes(lower)) candidateUids.add(doc.id);
  });

  for (const uid of Array.from(candidateUids).slice(0, 12)) {
    if (!results.some((result) => result.type === 'member' && result.id === uid)) {
      results.push(memberSearchResult(await resolveAdminMember(uid), 'Matched recent users/profiles'));
    }
  }

  return results;
}

export async function writeAdminAuditLog(
  admin: AdminRecord,
  payload: Record<string, unknown>,
): Promise<void> {
  await addDoc(collection(db, 'adminAuditLogs'), {
    adminUid: admin.uid,
    adminEmail: admin.email ?? '',
    createdAt: serverTimestamp(),
    source: 'admin_console',
    ...omitUndefined(payload),
  });
}

export async function setProfileModerationStatus(
  admin: AdminRecord,
  profile: AdminDoc,
  status: 'hidden' | 'visible' | 'under_review',
  reason: string,
): Promise<void> {
  const beforeSnapshot = profile.data;
  const updates =
    status === 'visible'
      ? { moderationStatus: 'visible', isVisible: true, updatedAt: Date.now() }
      : status === 'hidden'
        ? { moderationStatus: 'hidden', isVisible: false, updatedAt: Date.now() }
        : { moderationStatus: 'under_review', updatedAt: Date.now() };

  await updateDoc(doc(db, 'profiles', profile.id), updates);
  await writeAdminAuditLog(admin, {
    action: status === 'hidden' ? 'HIDE_PROFILE' : status === 'visible' ? 'UNHIDE_PROFILE' : 'MARK_PROFILE_UNDER_REVIEW',
    targetUid: profile.id,
    reason,
    beforeSnapshot,
  });
}

export async function deleteProfileDoc(
  admin: AdminRecord,
  profile: AdminDoc,
  reason: string,
): Promise<void> {
  const beforeSnapshot = profile.data;
  await writeAdminAuditLog(admin, {
    action: 'DELETE_PROFILE_DOC',
    targetUid: profile.id,
    reason,
    beforeSnapshot,
  });
  await deleteDoc(doc(db, 'profiles', profile.id));
}

export interface BulkDeleteProfileDocsResult {
  bulkOperationId: string;
  deleted: string[];
  failed: Array<{ uid: string; error: string }>;
}

export async function bulkDeleteProfileDocs({
  admin,
  profiles,
  reason,
}: {
  admin: AdminRecord;
  profiles: AdminDoc[];
  reason: string;
}): Promise<BulkDeleteProfileDocsResult> {
  const bulkOperationId = `bulk_profile_delete_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const selectedCount = profiles.length;
  const targetUids = profiles.map((profile) => profile.id);
  const deleted: string[] = [];
  const failed: Array<{ uid: string; error: string }> = [];

  await writeAdminAuditLog(admin, {
    action: 'BULK_DELETE_PROFILE_DOCS',
    reason,
    selectedCount,
    targetUids,
    bulkOperationId,
  });

  for (const profile of profiles) {
    try {
      await writeAdminAuditLog(admin, {
        action: 'BULK_DELETE_PROFILE_DOC_ITEM',
        targetUid: profile.id,
        reason,
        beforeSnapshot: profile.data,
        bulkOperationId,
        selectedCount,
      });
      await deleteDoc(doc(db, 'profiles', profile.id));
      deleted.push(profile.id);
    } catch (error) {
      failed.push({
        uid: profile.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return { bulkOperationId, deleted, failed };
}

export function docToAdminDoc(snap: QueryDocumentSnapshot<DocumentData>): AdminDoc {
  return { id: snap.id, data: snap.data() as Record<string, unknown> };
}

export function formatValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string') return value || '—';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(formatValue).join(', ');
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toLocaleString();
  }
  return JSON.stringify(value);
}

export function formatDate(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'number') return new Date(value).toLocaleString();
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toLocaleString();
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? value : new Date(parsed).toLocaleString();
  }
  return '—';
}

export function formatDateHeading(value: unknown): string {
  const ms = toMillis(value);
  if (!ms) return 'Undated';
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(ms));
}

export function formatTime(value: unknown): string {
  const ms = toMillis(value);
  if (!ms) return 'Time unknown';
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms));
}

export function formatRelativeTime(value: unknown): string {
  const ms = toMillis(value);
  if (!ms) return 'Unknown time';
  const diff = Date.now() - ms;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return 'Just now';
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return formatDate(value);
}

export function shortId(value: string, head = 8, tail = 5): string {
  if (!value) return '—';
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function messageText(data: Record<string, unknown>): string {
  return getString(data, ['text', 'body', 'message']) || 'No message text';
}

export function messageSenderId(data: Record<string, unknown>): string {
  return getString(data, ['senderId', 'senderUid', 'from']);
}

export function messageTimestamp(data: Record<string, unknown>): unknown {
  return data.createdAt ?? data.sentAt ?? data.timestamp ?? data.updatedAt;
}

export function isMessageDeleted(data: Record<string, unknown>): boolean {
  return data.deleted === true || data.hidden === true;
}

export function readByList(data: Record<string, unknown>): string[] {
  const value = data.readBy;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function hasReadMetadata(data: Record<string, unknown>): boolean {
  return readByList(data).length > 0 || data.readAt != null || data.readBy != null;
}

export function initialsFor(nameOrUid: string): string {
  const clean = nameOrUid.trim();
  if (!clean) return 'U';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

export async function resolveParticipants(uids: string[]): Promise<Record<string, ParticipantInfo>> {
  const unique = Array.from(new Set(uids.filter(Boolean)));
  const entries = await Promise.all(unique.map(async (uid) => {
    const [profile, user] = await Promise.all([
      fetchDocument('profiles', uid).catch(() => null),
      fetchDocument('users', uid).catch(() => null),
    ]);
    const displayName =
      (profile ? getString(profile.data, ['name', 'fullName', 'displayName']) : '') ||
      (user ? getString(user.data, ['name', 'fullName', 'displayName']) : '') ||
      shortId(uid);
    const email = user ? getString(user.data, ['email']) : '';
    const photoUrl =
      (profile ? getString(profile.data, ['photo', 'photoUrl', 'profilePhoto']) : '') ||
      (profile && Array.isArray(profile.data.photos) && typeof profile.data.photos[0] === 'string' ? profile.data.photos[0] : '');

    return [
      uid,
      {
        uid,
        displayName,
        email: email || 'No email found',
        photoUrl,
        initials: initialsFor(displayName),
        profileExists: Boolean(profile),
        userExists: Boolean(user),
        profileStatus: formatValue(profile?.data.status ?? profile?.data.profileStatus ?? profile?.data.isVisible),
        moderationStatus: formatValue(profile?.data.moderationStatus),
      },
    ] as const;
  }));

  return Object.fromEntries(entries);
}

export function getString(data: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

export function getArray(data: Record<string, unknown>, key: string): string[] {
  const value = data[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function participantUidsFromConversation(data: Record<string, unknown>): string[] {
  return getArray(data, 'participants');
}

export function matchesSearch(doc: AdminDoc, search: string, fields: string[]): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  if (doc.id.toLowerCase().includes(q)) return true;
  return fields.some((field) => formatValue(doc.data[field]).toLowerCase().includes(q));
}

export async function copyToClipboard(value: string): Promise<void> {
  if (typeof navigator === 'undefined') return;
  await navigator.clipboard.writeText(value);
}

function omitUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function memberSearchResult(member: AdminMember, subtitle: string): AdminSearchResult {
  const existence = member.profileExists && member.userExists
    ? 'Profile and user records exist'
    : member.profileExists
      ? 'Profile exists · user record missing'
      : member.userExists
        ? 'User exists · profile not created or deleted'
        : 'No profile/user record found';
  return {
    type: 'member',
    id: member.uid,
    title: member.displayName,
    subtitle: `${subtitle} · ${existence} · UID / Profile ID ${shortId(member.uid)}${member.email ? ` · ${member.email}` : ''}`,
    href: `/admin/users/${member.uid}`,
  };
}

async function safeQueryDocs(
  collectionName: string,
  constraints: Parameters<typeof query>[1][],
  section: string,
  errors: Record<string, string>,
  pageLimit = ADMIN_PAGE_LIMIT,
): Promise<AdminDoc[]> {
  try {
    const snap = await getDocs(query(collection(db, collectionName), ...constraints, limit(pageLimit)));
    return snap.docs.map(docToAdminDoc);
  } catch (error) {
    errors[section] = errorMessage(error);
    return [];
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'This section could not be loaded.';
}

async function safeCount(collectionName: string): Promise<number | null> {
  try {
    const snap = await getCountFromServer(collection(db, collectionName));
    return snap.data().count;
  } catch {
    return null;
  }
}

async function safeCollectionGroupCount(collectionName: string): Promise<number | null> {
  try {
    const snap = await getCountFromServer(collectionGroup(db, collectionName));
    return snap.data().count;
  } catch {
    return null;
  }
}

function toMillis(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  if (typeof value === 'object' && value && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }
  return 0;
}
