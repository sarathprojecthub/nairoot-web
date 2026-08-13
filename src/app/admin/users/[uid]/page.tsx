'use client';

import Link from 'next/link';
import { use, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  AdminPageHeader,
  CopyButton,
  DataCard,
  EmptyState,
  ErrorState,
  RawJson,
  StatusPill,
} from '@/components/admin/AdminPrimitives';
import {
  ACCESS_REASONS,
  deleteProfileDoc,
  formatDate,
  formatTime,
  formatValue,
  getArray,
  getString,
  isMessageDeleted,
  loadMemberMirror,
  messageSenderId,
  messageText,
  messageTimestamp,
  participantUidsFromConversation,
  resolveParticipants,
  setProfileModerationStatus,
  shortId,
  writeAdminAuditLog,
  type AdminMember,
  type AdminRecord,
  type MemberMirrorData,
  type ParticipantInfo,
} from '@/lib/admin';
import { fetchAdminAccountMetadata, type AdminAccountClientResult } from '@/lib/adminAccountClient';

interface MirrorSnapshot {
  mirror: MemberMirrorData;
  participants: Record<string, ParticipantInfo>;
}

async function loadMirrorSnapshot(uid: string): Promise<MirrorSnapshot> {
  const mirror = await loadMemberMirror(uid);
  const relatedUids = new Set<string>();

  mirror.introductionsSent.concat(mirror.introductionsReceived).forEach((intro) => {
    const sender = getString(intro.data, ['senderId', 'fromUserId', 'fromUid']);
    const recipient = getString(intro.data, ['recipientId', 'toUserId', 'toUid']);
    if (sender) relatedUids.add(sender);
    if (recipient) relatedUids.add(recipient);
  });

  mirror.conversations.forEach((conversation) => {
    participantUidsFromConversation(conversation.data).forEach((id) => relatedUids.add(id));
  });

  return {
    mirror,
    participants: await resolveParticipants(Array.from(relatedUids)),
  };
}

export default function AdminMemberMirrorPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = use(params);
  return (
    <AdminShell permission="viewUsers">
      {(admin) => <MemberOperationsConsole admin={admin} uid={uid} />}
    </AdminShell>
  );
}

function MemberOperationsConsole({ admin, uid }: { admin: AdminRecord; uid: string }) {
  const { user, loading: authLoading } = useAuth();
  const [mirror, setMirror] = useState<MemberMirrorData | null>(null);
  const [participants, setParticipants] = useState<Record<string, ParticipantInfo>>({});
  const [accountState, setAccountState] = useState<AdminAccountClientResult | { kind: 'loading' }>({ kind: 'loading' });
  const [messageReason, setMessageReason] = useState('');
  const [messagesUnlocked, setMessagesUnlocked] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const pageLoggedRef = useRef(false);

  async function refreshMirror() {
    const snapshot = await loadMirrorSnapshot(uid);
    setMirror(snapshot.mirror);
    setParticipants(snapshot.participants);
  }

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const snapshot = await loadMirrorSnapshot(uid);
        if (!alive) return;
        setMirror(snapshot.mirror);
        setParticipants(snapshot.participants);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Member operations console failed to load.');
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, [uid]);

  useEffect(() => {
    if (!mirror || pageLoggedRef.current) return;
    pageLoggedRef.current = true;
    writeAdminAuditLog(admin, {
      action: 'VIEW_MEMBER_MIRROR',
      targetUid: uid,
    }).catch(() => {
      pageLoggedRef.current = false;
    });
  }, [admin, mirror, uid]);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    async function loadAccountMetadata() {
      if (authLoading) {
        return;
      }

      if (!user) {
        setAccountState({ kind: 'unauthorized', message: 'Authentication required.' });
        return;
      }

      setAccountState({ kind: 'loading' });
      try {
        const result = await fetchAdminAccountMetadata(uid, controller.signal);
        if (alive) setAccountState(result);
      } catch (err) {
        if (!alive || controller.signal.aborted) return;
        setAccountState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Unable to load account metadata.',
        });
      }
    }

    void loadAccountMetadata();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [authLoading, uid, user]);

  async function runProfileAction(action: 'hide' | 'unhide' | 'review') {
    if (!mirror?.member.profileDoc) return;
    const adminReason = window.prompt('Reason for this moderation action');
    if (!adminReason) return;
    setBusy(action);
    try {
      await setProfileModerationStatus(
        admin,
        mirror.member.profileDoc,
        action === 'hide' ? 'hidden' : action === 'unhide' ? 'visible' : 'under_review',
        adminReason,
      );
      setNotice('Profile moderation status updated.');
      await refreshMirror();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Profile action failed.');
    } finally {
      setBusy(null);
    }
  }

  async function confirmDeleteProfileDoc() {
    if (!mirror?.member.profileDoc || !deleteReason.trim() || !deleteConfirmed) return;
    setBusy('delete');
    try {
      await deleteProfileDoc(admin, mirror.member.profileDoc, deleteReason.trim());
      setNotice('Profile document deleted. Auth user, user doc, photos, conversations, messages, introductions, and audit logs were not deleted.');
      setDeleteOpen(false);
      setDeleteReason('');
      setDeleteConfirmed(false);
      await refreshMirror();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Profile delete failed.');
    } finally {
      setBusy(null);
    }
  }

  async function unlockMessages() {
    if (!mirror || !messageReason) return;
    setBusy('messages');
    try {
      await writeAdminAuditLog(admin, {
        action: 'VIEW_MEMBER_MIRROR_MESSAGES',
        reason: messageReason,
        targetUid: uid,
        conversationIds: mirror.conversations.map((conversation) => conversation.id),
      });
      setMessagesUnlocked(true);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Audit log write failed. Messages were not shown.');
    } finally {
      setBusy(null);
    }
  }

  if (error) return <ErrorState message={error} />;
  if (!mirror) {
    return <EmptyState title="Loading member operations console" body="Gathering account, profile, moderation, photos, and related activity." />;
  }
  if (!mirror.member.userExists && !mirror.member.profileExists) return <MemberNotFound uid={uid} />;

  const photos = collectPhotoUrls(mirror.member);
  const statusBadges = buildStatusBadges(mirror, accountState);

  return (
    <>
      <AdminPageHeader
        title="Member operations console"
        eyebrow="User operations"
        subtitle="Internal view for account identity, profile review, moderation context, photos, related activity, and destructive actions."
      >
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/users" className="admin-secondary">Back to directory</Link>
          <CopyButton value={uid} label="Copy UID" />
        </div>
      </AdminPageHeader>

      {notice && <NoticeBanner message={notice} />}

      <div className="space-y-6">
        <SummaryHeader member={mirror.member} badges={statusBadges} accountState={accountState} photos={photos} />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <div className="space-y-6">
            <AccountSection member={mirror.member} accountState={accountState} />
            <ProfileSection member={mirror.member} />
            <SafetyModerationSection member={mirror.member} mirror={mirror} busy={busy} runProfileAction={runProfileAction} />
            <RelatedActivitySection mirror={mirror} uid={uid} />
          </div>

          <div className="space-y-6">
            <PhotoGallerySection member={mirror.member} photos={photos} />
            <StatusSummarySection mirror={mirror} accountState={accountState} />
            <ActionPanel member={mirror.member} busy={busy} runProfileAction={runProfileAction} />
          </div>
        </div>

        <DangerZoneSection member={mirror.member} openDeleteModal={() => setDeleteOpen(true)} busy={busy} />
        <RawDataSection
          mirror={mirror}
          participants={participants}
          messageReason={messageReason}
          setMessageReason={setMessageReason}
          messagesUnlocked={messagesUnlocked}
          busy={busy === 'messages'}
          unlockMessages={unlockMessages}
          accountState={accountState}
        />
      </div>

      {deleteOpen && mirror.member.profileDoc && (
        <DeleteProfileDocModal
          uid={uid}
          reason={deleteReason}
          confirmed={deleteConfirmed}
          busy={busy === 'delete'}
          setReason={setDeleteReason}
          setConfirmed={setDeleteConfirmed}
          onCancel={() => setDeleteOpen(false)}
          onDelete={confirmDeleteProfileDoc}
        />
      )}
    </>
  );
}

function MemberNotFound({ uid }: { uid: string }) {
  return (
    <>
      <AdminPageHeader
        title="Member operations console"
        eyebrow="User operations"
        subtitle="No user document or profile document exists for this UID."
      >
        <Link href="/admin/users" className="admin-secondary">Back to directory</Link>
      </AdminPageHeader>
      <DataCard className="p-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">No member found</p>
          <h3 className="mt-2 font-serif text-3xl font-semibold text-charcoal">No member found for this UID</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            The Admin Console checked both <span className="font-mono">users/{uid}</span> and <span className="font-mono">profiles/{uid}</span>.
            Neither document exists. This can happen for a mistyped UID, a deleted test profile, or an account that has not created any Firestore records yet.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <CopyButton value={uid} label="Copy searched UID" />
            <Link href="/admin/users" className="admin-secondary">Open member directory</Link>
            <Link href="/admin" className="admin-primary">Search again</Link>
          </div>
        </div>
      </DataCard>
    </>
  );
}

function SummaryHeader({
  member,
  badges,
  accountState,
  photos,
}: {
  member: AdminMember;
  badges: Array<{ label: string; tone: 'neutral' | 'good' | 'warn' | 'danger' }>;
  accountState: AdminAccountClientResult | { kind: 'loading' };
  photos: string[];
}) {
  const location = joinFormattedValues([member.profileDoc?.data.city, member.profileDoc?.data.state], ', ');
  const ageGender = joinFormattedValues([member.profileDoc?.data.age, member.profileDoc?.data.gender], ' Â· ');
  const accountStatus = describeAccountStatus(member, accountState);
  const profileStatus = member.profileExists ? member.moderationStatus : 'Profile missing';

  return (
    <DataCard className="overflow-hidden border-gold/20 bg-gradient-to-br from-cream via-ivory to-white">
      <div className="grid gap-6 p-6 lg:grid-cols-[112px_minmax(0,1fr)_280px] lg:items-start">
        <PhotoAvatar url={photos[0] ?? null} alt={member.displayName} initials={member.initials} className="h-28 w-28 rounded-3xl" />

        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Member summary</p>
              <h2 className="mt-2 break-words font-serif text-3xl font-semibold text-charcoal">{member.displayName}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {badges.length > 0 ? badges.map((badge) => (
                  <StatusPill key={badge.label} tone={badge.tone}>{badge.label}</StatusPill>
                )) : <StatusPill>Profile status available</StatusPill>}
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-white/75 px-4 py-3 text-sm text-muted shadow-sm">
              <p><span className="font-semibold text-charcoal">UID:</span> <span className="font-mono">{shortId(member.uid)}</span></p>
              <p className="mt-1"><span className="font-semibold text-charcoal">Account:</span> {accountStatus}</p>
              <p className="mt-1"><span className="font-semibold text-charcoal">Profile:</span> {profileStatus}</p>
            </div>
          </div>

          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <SummaryField label="Age / gender" value={ageGender || 'Not provided'} />
            <SummaryField label="City / state" value={location || 'Not provided'} />
            <SummaryField label="Matrimony ID" value={formatFieldValue(member.profileDoc?.data.matrimonyId ?? member.profileDoc?.data.memberId ?? member.userDoc?.data.matrimonyId ?? member.userDoc?.data.memberId ?? 'Not assigned')} />
            <SummaryField label="Primary photo" value={photos.length > 0 ? 'Available' : 'Missing'} />
          </dl>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <QuickSummary label="Visibility" value={member.isVisible === false ? 'Hidden' : member.profileExists ? 'Visible or unset' : 'No profile'} tone={member.isVisible === false ? 'danger' : member.profileExists ? 'good' : 'warn'} />
          <QuickSummary label="Moderation" value={member.moderationStatus} tone={member.moderationStatus.includes('under') ? 'warn' : member.moderationStatus.includes('hidden') ? 'danger' : 'neutral'} />
          <QuickSummary label="Account access" value={describeAccountSummary(accountState)} tone={accountState.kind === 'success' ? 'good' : accountState.kind === 'forbidden' ? 'warn' : accountState.kind === 'loading' ? 'neutral' : 'danger'} />
        </div>
      </div>
    </DataCard>
  );
}

function AccountSection({
  member,
  accountState,
}: {
  member: AdminMember;
  accountState: AdminAccountClientResult | { kind: 'loading' };
}) {
  const piiRestricted = accountState.kind === 'forbidden';
  const fields = [
    { label: 'Login email', value: piiRestricted ? 'Restricted' : accountState.kind === 'success' ? accountState.data.email ?? 'Not provided' : 'Not available' },
    { label: 'Email verified', value: piiRestricted ? 'Restricted' : accountState.kind === 'success' ? yesNo(accountState.data.emailVerified) : 'Not available' },
    { label: 'Phone number', value: piiRestricted ? 'Restricted' : accountState.kind === 'success' ? accountState.data.phoneNumber ?? 'Not provided' : 'Not available' },
    { label: 'Authentication provider(s)', value: piiRestricted ? 'Restricted' : accountState.kind === 'success' ? accountState.data.providers.join(', ') || 'Not provided' : 'Not available' },
    { label: 'Firebase UID', value: member.uid },
    { label: 'Account created', value: piiRestricted ? 'Restricted' : accountState.kind === 'success' ? accountState.data.creationTime ?? 'Unknown' : 'Not available' },
    { label: 'Last sign-in', value: piiRestricted ? 'Restricted' : accountState.kind === 'success' ? accountState.data.lastSignInTime ?? 'Unknown' : 'Not available' },
    { label: 'Account disabled', value: piiRestricted ? 'Restricted' : accountState.kind === 'success' ? yesNo(accountState.data.disabled) : 'Not available' },
    { label: 'User document status', value: member.userExists ? 'Present' : 'Missing' },
    { label: 'Profile document status', value: member.profileExists ? 'Present' : 'Missing' },
  ];

  return (
    <DataCard className="p-5">
      <SectionHeading
        title="Account"
        description="Auth-native identity and sign-in metadata from the approved secure admin API, alongside Firestore document presence checks."
        badge={accountState.kind === 'success' ? <StatusPill tone="good">Account metadata loaded</StatusPill> : undefined}
      />
      <SectionAlert state={accountState} />
      <FieldGrid fields={fields} className="mt-4" />
      {accountState.kind === 'forbidden' && (
        <p className="mt-4 text-sm text-muted">You don&apos;t have permission to view account identity information.</p>
      )}
    </DataCard>
  );
}

function ProfileSection({ member }: { member: AdminMember }) {
  const profile = member.profileDoc?.data;
  if (!profile) return <EmptyState title="Profile" body="No public profile document exists for this UID." />;

  const fields = [
    { label: 'DOB', value: formatFieldValue(profile.dob ?? profile.dateOfBirth) },
    { label: 'Age', value: formatFieldValue(profile.age) },
    { label: 'Gender', value: formatFieldValue(profile.gender) },
    { label: 'State', value: formatFieldValue(profile.state) },
    { label: 'City', value: formatFieldValue(profile.city) },
    { label: 'Profession', value: formatFieldValue(profile.profession) },
    { label: 'Education', value: formatFieldValue(profile.education) },
    { label: 'Religion / community', value: joinFormattedValues([profile.religion, profile.community, profile.caste], ' Â· ') || 'Not provided' },
    { label: 'Mother tongue', value: formatFieldValue(profile.motherTongue) },
    { label: 'Marital status', value: formatFieldValue(profile.maritalStatus) },
    { label: 'Profile completion / quality', value: formatFieldValue(profile.profileQuality ?? profile.profileCompletion ?? profile.completionScore ?? profile.completed) },
    { label: 'Activity status', value: formatFieldValue(profile.status ?? profile.activityStatus ?? member.userDoc?.data.status) },
    { label: 'Created', value: profile.createdAt ? formatDate(profile.createdAt) : 'Not available' },
    { label: 'Updated', value: profile.updatedAt ? formatDate(profile.updatedAt) : 'Not available' },
  ];

  const textBlocks = [
    { title: 'About', body: firstMeaningfulString(profile, ['bio', 'about']) },
    { title: 'Looking for', body: firstMeaningfulString(profile, ['lookingFor']) },
    { title: 'Family background', body: firstMeaningfulString(profile, ['family', 'familyBackground']) },
  ].filter((item) => item.body);

  return (
    <DataCard className="p-5">
      <SectionHeading
        title="Profile"
        description="Structured public-profile fields for moderation and support review. Raw JSON remains available at the bottom for debugging."
      />
      <FieldGrid fields={fields} className="mt-4" />
      {textBlocks.length > 0 && (
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {textBlocks.map((block) => (
            <div key={block.title} className="rounded-2xl border border-line bg-ivory/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{block.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink/80">{block.body}</p>
            </div>
          ))}
        </div>
      )}
    </DataCard>
  );
}

function SafetyModerationSection({
  member,
  mirror,
  busy,
  runProfileAction,
}: {
  member: AdminMember;
  mirror: MemberMirrorData;
  busy: string | null;
  runProfileAction: (action: 'hide' | 'unhide' | 'review') => void;
}) {
  const policyVersion = member.userDoc?.data.policyAcceptedVersion ?? member.profileDoc?.data.policyAcceptedVersion;
  const policyAcceptedAt = member.userDoc?.data.policyAcceptedAt ?? member.profileDoc?.data.policyAcceptedAt;
  const deletionRequestStatus = member.userDoc?.data.deletionRequestStatus ?? member.profileDoc?.data.deletionRequestStatus;
  const phoneVerified = member.userDoc?.data.phoneVerified ?? member.userDoc?.data.isPhoneVerified;
  const blockedCount = deriveCount(member, ['blockedUserIds', 'blockedUsers', 'blockedProfiles', 'blocked']);
  const hiddenCount = deriveCount(member, ['hiddenProfiles', 'hiddenUserIds', 'hiddenUsers']);

  return (
    <DataCard className="p-5">
      <SectionHeading
        title="Safety & Moderation"
        description="Live moderation status, policy acceptance, reported activity, and the existing profile-control actions."
      />
      <FieldGrid
        className="mt-4"
        fields={[
          { label: 'isVisible', value: member.isVisible == null ? 'Not set' : String(member.isVisible) },
          { label: 'moderationStatus', value: member.moderationStatus },
          { label: 'Reports filed by user', value: String(mirror.reportsByUser.length) },
          { label: 'Reports against user', value: String(mirror.reportsAgainstUser.length) },
          { label: 'Blocked user count', value: blockedCount },
          { label: 'Hidden profile count', value: hiddenCount },
          { label: 'Policy accepted version', value: formatFieldValue(policyVersion) },
          { label: 'Policy accepted at', value: policyAcceptedAt ? formatDate(policyAcceptedAt) : 'Not available' },
          { label: 'Phone verification', value: typeof phoneVerified === 'boolean' ? yesNo(phoneVerified) : 'Not available' },
          { label: 'Deletion request status', value: formatFieldValue(deletionRequestStatus) },
        ]}
      />

      <div className="mt-5 flex flex-wrap gap-2">
        {member.profileDoc && (
          <>
            <button disabled={busy === 'hide'} onClick={() => runProfileAction('hide')} className="admin-secondary">Hide profile</button>
            <button disabled={busy === 'unhide'} onClick={() => runProfileAction('unhide')} className="admin-secondary">Unhide profile</button>
            <button disabled={busy === 'review'} onClick={() => runProfileAction('review')} className="admin-secondary">Mark under review</button>
          </>
        )}
        <Link href={`/admin/conversations?search=${encodeURIComponent(member.uid)}`} className="admin-primary">View conversations</Link>
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-ivory/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Recent admin audit activity</p>
            <p className="mt-1 text-sm text-muted">Shown only because these audit records are already fetched by the existing Member Mirror loader.</p>
          </div>
          <StatusPill>{mirror.auditLogs.length} events loaded</StatusPill>
        </div>
        {mirror.auditLogs.length > 0 ? (
          <div className="mt-4 space-y-3">
            {mirror.auditLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="rounded-2xl border border-line bg-white/80 p-3 text-sm">
                <p className="font-semibold text-charcoal">{formatFieldValue(log.data.action)}</p>
                <p className="mt-1 text-muted">{formatDate(log.data.createdAt)} at {formatTime(log.data.createdAt)}</p>
                <p className="mt-1 text-muted">By {formatFieldValue(log.data.adminUid)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">No recent admin audit events were loaded for this member.</p>
        )}
      </div>
    </DataCard>
  );
}

function PhotoGallerySection({ member, photos }: { member: AdminMember; photos: string[] }) {
  return (
    <DataCard className="p-5">
      <SectionHeading
        title="Photos"
        description="Primary photo is emphasized first. Remaining photos are view-only thumbnails for quick moderation review."
      />

      {photos.length === 0 ? (
        <PhotoPlaceholder className="mt-4 h-64 rounded-3xl" label="No profile photos found" />
      ) : (
        <div className="mt-4 space-y-4">
          <PhotoTile url={photos[0]} alt={member.displayName} primary />
          {photos.length > 1 && (
            <div className="grid grid-cols-2 gap-3">
              {photos.slice(1).map((url, index) => (
                <PhotoTile key={`${url}-${index}`} url={url} alt={`${member.displayName} photo ${index + 2}`} />
              ))}
            </div>
          )}
        </div>
      )}
    </DataCard>
  );
}

function StatusSummarySection({
  mirror,
  accountState,
}: {
  mirror: MemberMirrorData;
  accountState: AdminAccountClientResult | { kind: 'loading' };
}) {
  const photos = collectPhotoUrls(mirror.member);
  const totalMessages = Object.values(mirror.messagesByConversation).reduce((sum, docs) => sum + docs.length, 0);

  return (
    <DataCard className="p-5">
      <SectionHeading title="Status summary" description="Quick operational totals already available from the current member data load." />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <QuickSummary label="Introductions" value={`${mirror.introductionsSent.length + mirror.introductionsReceived.length} total`} tone="neutral" />
        <QuickSummary label="Accepted matches" value={String(mirror.acceptedIntroductions.length)} tone={mirror.acceptedIntroductions.length > 0 ? 'good' : 'neutral'} />
        <QuickSummary label="Conversations" value={String(mirror.conversations.length)} tone={mirror.conversations.length > 0 ? 'good' : 'neutral'} />
        <QuickSummary label="Messages loaded" value={String(totalMessages)} tone={totalMessages > 0 ? 'good' : 'neutral'} />
        <QuickSummary label="Photos" value={String(photos.length)} tone={photos.length > 0 ? 'good' : 'warn'} />
        <QuickSummary label="Account metadata" value={describeAccountSummary(accountState)} tone={accountState.kind === 'success' ? 'good' : accountState.kind === 'loading' ? 'neutral' : 'warn'} />
      </div>
    </DataCard>
  );
}

function ActionPanel({
  member,
  busy,
  runProfileAction,
}: {
  member: AdminMember;
  busy: string | null;
  runProfileAction: (action: 'hide' | 'unhide' | 'review') => void;
}) {
  return (
    <DataCard className="p-5">
      <SectionHeading title="Actions" description="Existing moderation actions and admin navigation, without changing their semantics." />
      <div className="mt-4 flex flex-col gap-3">
        <CopyButton value={member.uid} label="Copy UID" />
        <Link href={`/admin/profiles?search=${encodeURIComponent(member.uid)}`} className="admin-secondary">Open profile list</Link>
        <Link href={`/admin/conversations?search=${encodeURIComponent(member.uid)}`} className="admin-secondary">Open conversations</Link>
        <Link href="/admin/deletion-requests" className="admin-secondary">Open deletion requests</Link>
        {member.profileDoc && (
          <>
            <button disabled={busy === 'hide'} onClick={() => runProfileAction('hide')} className="admin-secondary">Hide profile</button>
            <button disabled={busy === 'unhide'} onClick={() => runProfileAction('unhide')} className="admin-secondary">Unhide profile</button>
            <button disabled={busy === 'review'} onClick={() => runProfileAction('review')} className="admin-secondary">Mark under review</button>
          </>
        )}
      </div>
    </DataCard>
  );
}

function RelatedActivitySection({ mirror, uid }: { mirror: MemberMirrorData; uid: string }) {
  const items: Array<{ label: string; value: string; href?: string; note?: string }> = [
    {
      label: 'Introductions',
      value: String(mirror.introductionsSent.length + mirror.introductionsReceived.length),
      note: `${mirror.introductionsSent.length} sent Â· ${mirror.introductionsReceived.length} received`,
    },
    {
      label: 'Conversations',
      value: String(mirror.conversations.length),
      href: `/admin/conversations?search=${encodeURIComponent(uid)}`,
    },
    {
      label: 'Reports',
      value: String(mirror.reportsByUser.length + mirror.reportsAgainstUser.length),
      href: '/admin/reports',
      note: `${mirror.reportsAgainstUser.length} against Â· ${mirror.reportsByUser.length} filed`,
    },
    {
      label: 'Notifications',
      value: String(mirror.notifications.length),
    },
    {
      label: 'Profile views',
      value: String(mirror.profileViewsSent.length + mirror.profileViewsReceived.length),
      note: `${mirror.profileViewsReceived.length} received Â· ${mirror.profileViewsSent.length} sent`,
    },
    {
      label: 'Deletion requests',
      value: 'Not loaded',
      href: '/admin/deletion-requests',
      note: 'This page does not fetch the deletion-request collection directly in Phase 2.',
    },
    {
      label: 'Premium / waitlist',
      value: mirror.waitlist ? 'Waitlisted' : String(Boolean(mirror.member.profileDoc?.data.isPremium)),
      href: '/admin/waitlist',
      note: mirror.waitlist ? 'Premium waitlist document loaded' : 'No premium waitlist document loaded',
    },
  ];

  return (
    <DataCard className="p-5">
      <SectionHeading title="Related activity" description="Compact operational counts from data the existing Member Mirror already loads." />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl border border-line bg-ivory/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{item.label}</p>
                <p className="mt-2 font-serif text-2xl font-semibold text-charcoal">{item.value}</p>
              </div>
              {item.href && <Link href={item.href} className="text-sm font-semibold text-maroon hover:underline">Open</Link>}
            </div>
            {item.note && <p className="mt-2 text-sm text-muted">{item.note}</p>}
          </div>
        ))}
      </div>
    </DataCard>
  );
}

function DangerZoneSection({
  member,
  openDeleteModal,
  busy,
}: {
  member: AdminMember;
  openDeleteModal: () => void;
  busy: string | null;
}) {
  return (
    <DataCard className="border-red-200 bg-red-50/60 p-5">
      <SectionHeading title="Danger Zone" description="Delete profile document keeps the current semantics exactly: it removes only profiles/{uid} and does not delete the Auth account, users/{uid}, conversations, messages, introductions, or audit logs." />
      {member.profileDoc ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button disabled={busy === 'delete'} onClick={openDeleteModal} className="rounded-full border border-red-700 bg-red-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">
            Delete profile document
          </button>
          <p className="text-sm text-red-800/90">Use this only when you explicitly want to keep the Firebase Auth account and user document intact.</p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-red-800/90">There is no profile document to delete for this UID.</p>
      )}
    </DataCard>
  );
}

function RawDataSection({
  mirror,
  participants,
  messageReason,
  setMessageReason,
  messagesUnlocked,
  busy,
  unlockMessages,
  accountState,
}: {
  mirror: MemberMirrorData;
  participants: Record<string, ParticipantInfo>;
  messageReason: string;
  setMessageReason: (value: string) => void;
  messagesUnlocked: boolean;
  busy: boolean;
  unlockMessages: () => void;
  accountState: AdminAccountClientResult | { kind: 'loading' };
}) {
  const messages = useMemo(
    () => Object.entries(mirror.messagesByConversation).flatMap(([conversationId, docs]) => docs.map((message) => ({ conversationId, message }))),
    [mirror.messagesByConversation],
  );

  return (
    <DataCard className="p-5">
      <SectionHeading title="Developer / Raw data" description="Collapsed technical detail for debugging. Structured account, profile, moderation, and photo views above remain the primary workflow." />
      <div className="mt-4 space-y-4">
        <RawJson data={mirror.member.userDoc?.data ?? null} label="User document JSON" />
        <RawJson data={mirror.member.profileDoc?.data ?? null} label="Profile document JSON" />
        <RawJson data={{ sectionErrors: mirror.sectionErrors, accountState }} label="Load state and section errors" />
        <RawJson
          data={{
            introductionsSent: mirror.introductionsSent,
            introductionsReceived: mirror.introductionsReceived,
            acceptedIntroductions: mirror.acceptedIntroductions,
            conversations: mirror.conversations,
            reportsByUser: mirror.reportsByUser,
            reportsAgainstUser: mirror.reportsAgainstUser,
            profileViewsSent: mirror.profileViewsSent,
            profileViewsReceived: mirror.profileViewsReceived,
            notifications: mirror.notifications,
            waitlist: mirror.waitlist,
            auditLogs: mirror.auditLogs,
            participants,
          }}
          label="Related activity raw data"
        />

        <details className="rounded-xl border border-line bg-ivory/70 p-4">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.16em] text-muted">Protected message transcript</summary>
          {!messagesUnlocked ? (
            <div className="mt-4 rounded-2xl border border-gold/20 bg-white/70 p-4">
              <p className="font-semibold text-charcoal">Reason for viewing this member&apos;s messages</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {ACCESS_REASONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMessageReason(item)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${messageReason === item ? 'bg-maroon text-cream' : 'border border-line bg-cream text-muted hover:border-gold'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="button" disabled={!messageReason || busy} onClick={unlockMessages} className="admin-primary">
                  {busy ? 'Logging accessâ€¦' : 'Log access and reveal transcript'}
                </button>
                <p className="text-sm text-muted">This writes the existing audit log event before revealing transcript data already loaded on this page.</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No messages were loaded for this member.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {messages.map(({ conversationId, message }) => {
                const sender = messageSenderId(message.data);
                const senderName = participants[sender]?.displayName ?? shortId(sender);
                return (
                  <div key={`${conversationId}:${message.id}`} className="rounded-2xl border border-line bg-white/80 p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold text-charcoal">{senderName}</p>
                      <p className="text-muted">{formatDate(messageTimestamp(message.data))}</p>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-ink/80">{messageText(message.data)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusPill>{shortId(conversationId)}</StatusPill>
                      {isMessageDeleted(message.data) && <StatusPill tone="warn">Deleted / hidden</StatusPill>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </details>
      </div>
    </DataCard>
  );
}

function DeleteProfileDocModal({
  uid,
  reason,
  confirmed,
  busy,
  setReason,
  setConfirmed,
  onCancel,
  onDelete,
}: {
  uid: string;
  reason: string;
  confirmed: boolean;
  busy: boolean;
  setReason: (value: string) => void;
  setConfirmed: (value: boolean) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const canDelete = reason.trim().length > 0 && confirmed && !busy;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/45 px-4 py-6">
      <div role="dialog" aria-modal="true" className="w-full max-w-xl rounded-3xl border border-red-200 bg-cream p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">Destructive profile action</p>
        <h2 className="mt-2 font-serif text-2xl font-semibold text-charcoal">Delete profile document?</h2>
        <div className="mt-5 space-y-4 text-sm leading-relaxed text-ink/80">
          <p>This will delete only the public profile document:<br /><span className="font-mono text-charcoal">profiles/{uid}</span></p>
          <div className="rounded-2xl border border-line bg-ivory p-4">
            <p className="font-semibold text-charcoal">This will not delete:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
              <li>Firebase Auth user</li>
              <li><span className="font-mono">users/{uid}</span></li>
              <li>Storage photos</li>
              <li>conversations or messages</li>
              <li>introductions</li>
              <li>audit logs</li>
            </ul>
          </div>
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 font-medium text-amber-800">
            Use this only for test profiles, broken profiles, or profiles that should be removed from discovery. For real users, hiding the profile is usually safer.
          </p>
        </div>
        <label className="mt-5 block text-sm font-semibold text-charcoal" htmlFor="mirror-delete-reason">Reason for deletion</label>
        <textarea
          id="mirror-delete-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={busy}
          rows={3}
          className="mt-2 w-full resize-none rounded-2xl border border-line-strong bg-ivory px-4 py-3 text-sm outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
        />
        <label className="mt-4 flex items-start gap-3 rounded-2xl border border-line bg-ivory p-4 text-sm text-ink/80">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={busy} className="mt-1 h-4 w-4 rounded border-line-strong" />
          <span>I understand this deletes only the profile document.</span>
        </label>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={busy} className="admin-secondary">Cancel</button>
          <button type="button" onClick={onDelete} disabled={!canDelete} className="rounded-full border border-red-700 bg-red-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? 'Deleting...' : 'Delete profile document'}
          </button>
        </div>
      </div>
    </div>
  );
}

function NoticeBanner({ message }: { message: string }) {
  return <div className="mb-4 rounded-2xl border border-gold/30 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{message}</div>;
}

function SectionHeading({ title, description, badge }: { title: string; description?: string; badge?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 className="font-serif text-2xl font-semibold text-charcoal">{title}</h3>
        {description && <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {badge}
    </div>
  );
}

function SectionAlert({ state }: { state: AdminAccountClientResult | { kind: 'loading' } }) {
  if (state.kind === 'loading') {
    return <p className="mt-4 rounded-2xl border border-line bg-ivory/70 px-4 py-3 text-sm text-muted">Loading account metadata from the secure admin APIâ€¦</p>;
  }
  if (state.kind === 'success') return null;

  const toneClass = state.kind === 'forbidden'
    ? 'border-amber-200 bg-amber-50 text-amber-800'
    : 'border-red-200 bg-red-50 text-red-800';

  return <p className={`mt-4 rounded-2xl px-4 py-3 text-sm ${toneClass}`}>{state.message}</p>;
}

function FieldGrid({
  fields,
  className = '',
}: {
  fields: Array<{ label: string; value: string }>;
  className?: string;
}) {
  return (
    <dl className={`grid gap-3 text-sm sm:grid-cols-2 ${className}`.trim()}>
      {fields.map((field) => (
        <div key={field.label} className="rounded-2xl border border-line bg-ivory/70 p-4">
          <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{field.label}</dt>
          <dd className="mt-2 break-words text-ink">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white/75 p-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="mt-2 break-words text-sm text-ink">{value}</dd>
    </div>
  );
}

function QuickSummary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'neutral' | 'good' | 'warn' | 'danger';
}) {
  return (
    <div className="rounded-2xl border border-line bg-white/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-2 font-serif text-xl font-semibold text-charcoal">{value}</p>
      <div className="mt-3"><StatusPill tone={tone}>{tone === 'neutral' ? 'Available' : tone}</StatusPill></div>
    </div>
  );
}

function PhotoAvatar({
  url,
  alt,
  initials,
  className,
}: {
  url: string | null;
  alt: string;
  initials: string;
  className: string;
}) {
  const [broken, setBroken] = useState(false);

  if (!url || broken) {
    return (
      <div className={`${className} flex items-center justify-center bg-maroon text-2xl font-semibold text-cream`}>
        {initials}
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={`${className} object-cover`} onError={() => setBroken(true)} />;
}

function PhotoTile({ url, alt, primary = false }: { url: string; alt: string; primary?: boolean }) {
  const [broken, setBroken] = useState(false);
  const wrapperClass = primary ? 'aspect-[4/5] w-full rounded-3xl' : 'aspect-[4/5] w-full rounded-2xl';

  if (broken) {
    return <PhotoPlaceholder className={wrapperClass} label={primary ? 'Primary photo unavailable' : 'Photo unavailable'} />;
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" className={`block overflow-hidden border border-line bg-ivory ${wrapperClass}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className="h-full w-full object-cover" onError={() => setBroken(true)} />
      <div className="border-t border-line bg-white/85 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
        {primary ? 'Primary photo' : 'View full size'}
      </div>
    </a>
  );
}

function PhotoPlaceholder({ className, label }: { className: string; label: string }) {
  return (
    <div className={`${className} flex items-center justify-center border border-dashed border-line-strong bg-ivory px-4 text-center text-sm font-medium text-muted`}>
      {label}
    </div>
  );
}

function buildStatusBadges(
  mirror: MemberMirrorData,
  accountState: AdminAccountClientResult | { kind: 'loading' },
): Array<{ label: string; tone: 'neutral' | 'good' | 'warn' | 'danger' }> {
  const badges: Array<{ label: string; tone: 'neutral' | 'good' | 'warn' | 'danger' }> = [];
  const profile = mirror.member.profileDoc?.data;
  const hidden = mirror.member.isVisible === false || mirror.member.moderationStatus === 'hidden';
  const underReview = mirror.member.moderationStatus === 'under_review';
  const qualityValue = profile?.profileQuality ?? profile?.profileCompletion ?? profile?.completionScore;
  const incomplete = typeof qualityValue === 'number' ? qualityValue < 100 : profile?.completed === false;

  if (hidden) badges.push({ label: 'Hidden', tone: 'danger' });
  else if (mirror.member.profileExists) badges.push({ label: 'Visible', tone: 'good' });
  if (underReview) badges.push({ label: 'Under review', tone: 'warn' });
  if (incomplete) badges.push({ label: 'Incomplete', tone: 'warn' });
  if (accountState.kind === 'success') {
    badges.push({ label: accountState.data.emailVerified ? 'Email verified' : 'Email unverified', tone: accountState.data.emailVerified ? 'good' : 'warn' });
  }
  if (profile?.isPremium === true) badges.push({ label: 'Premium', tone: 'good' });
  if (mirror.waitlist) badges.push({ label: 'Waitlisted', tone: 'warn' });
  if (!mirror.member.profileExists) badges.push({ label: 'Profile missing', tone: 'danger' });
  if (!mirror.member.userExists) badges.push({ label: 'User doc missing', tone: 'danger' });

  return badges;
}

function collectPhotoUrls(member: AdminMember): string[] {
  const profile = member.profileDoc?.data ?? {};
  const userDoc = member.userDoc?.data ?? {};
  const urls = [
    member.photoUrl,
    getString(profile, ['photo', 'photoUrl', 'profilePhoto']),
    ...getArray(profile, 'photos'),
    ...getArray(userDoc, 'photos'),
  ];
  return Array.from(new Set(urls.map((url) => url.trim()).filter(Boolean)));
}

function joinFormattedValues(values: unknown[], separator: string): string {
  return values
    .map((value) => formatValue(value))
    .filter((value) => value && value !== 'â€”')
    .join(separator);
}

function formatFieldValue(value: unknown): string {
  const formatted = formatValue(value);
  return formatted === 'â€”' ? 'Not provided' : formatted;
}

function firstMeaningfulString(data: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function yesNo(value: boolean): string {
  return value ? 'Yes' : 'No';
}

function deriveCount(member: AdminMember, keys: string[]): string {
  const sources = [member.userDoc?.data ?? {}, member.profileDoc?.data ?? {}];
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (Array.isArray(value)) return String(value.length);
      if (typeof value === 'number') return String(value);
    }
  }
  return 'Not available';
}

function describeAccountSummary(state: AdminAccountClientResult | { kind: 'loading' }): string {
  switch (state.kind) {
    case 'loading':
      return 'Loading';
    case 'success':
      return 'Available';
    case 'forbidden':
      return 'Restricted';
    case 'not-found':
      return 'Auth user missing';
    case 'unauthorized':
      return 'Re-authenticate';
    case 'config-error':
      return 'Server config unavailable';
    case 'error':
      return 'Error';
    default:
      return 'Unknown';
  }
}

function describeAccountStatus(member: AdminMember, state: AdminAccountClientResult | { kind: 'loading' }): string {
  if (!member.userExists) return 'User document missing';
  switch (state.kind) {
    case 'loading':
      return 'Loading account metadata';
    case 'success':
      return state.data.disabled ? 'Auth account disabled' : 'Auth account active';
    case 'forbidden':
      return 'Restricted';
    case 'not-found':
      return 'Auth account not found';
    case 'unauthorized':
      return 'Authentication required';
    case 'config-error':
      return 'Server configuration unavailable';
    case 'error':
      return 'Account lookup error';
    default:
      return 'Unknown';
  }
}
