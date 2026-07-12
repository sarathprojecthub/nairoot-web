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
  completedProfiles: number | null;
  hiddenProfiles: number | null;
  underReviewProfiles: number | null;
  introductions: number | null;
  conversations: number | null;
  messages: number | null;
  waitlist: number | null;
  reports: number | null;
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

  return {
    users,
    profiles,
    completedProfiles: profileDocs.filter((p) => Boolean(p.data.completed || p.data.isComplete || p.data.profileCompleted)).length,
    hiddenProfiles: profileDocs.filter((p) => p.data.moderationStatus === 'hidden' || p.data.isVisible === false).length,
    underReviewProfiles: profileDocs.filter((p) => p.data.moderationStatus === 'under_review').length,
    introductions,
    conversations,
    messages,
    waitlist,
    reports,
  };
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
