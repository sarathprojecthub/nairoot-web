'use client';

import Link from 'next/link';
import { use, useEffect, useMemo, useRef, useState } from 'react';
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
  formatDateHeading,
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
  type AdminDoc,
  type AdminMember,
  type AdminRecord,
  type MemberMirrorData,
  type ParticipantInfo,
} from '@/lib/admin';

export default function AdminMemberMirrorPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = use(params);
  return (
    <AdminShell permission="viewUsers">
      {(admin) => <MemberMirror admin={admin} uid={uid} />}
    </AdminShell>
  );
}

function MemberMirror({ admin, uid }: { admin: AdminRecord; uid: string }) {
  const [mirror, setMirror] = useState<MemberMirrorData | null>(null);
  const [participants, setParticipants] = useState<Record<string, ParticipantInfo>>({});
  const [reason, setReason] = useState('');
  const [messagesUnlocked, setMessagesUnlocked] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const pageLoggedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const data = await loadMemberMirror(uid);
        if (!alive) return;
        setMirror(data);
        const relatedUids = new Set<string>();
        data.introductionsSent.concat(data.introductionsReceived).forEach((intro) => {
          getString(intro.data, ['senderId', 'fromUserId', 'fromUid']) && relatedUids.add(getString(intro.data, ['senderId', 'fromUserId', 'fromUid']));
          getString(intro.data, ['recipientId', 'toUserId', 'toUid']) && relatedUids.add(getString(intro.data, ['recipientId', 'toUserId', 'toUid']));
        });
        data.conversations.forEach((conversation) => participantUidsFromConversation(conversation.data).forEach((id) => relatedUids.add(id)));
        const resolved = await resolveParticipants(Array.from(relatedUids));
        if (alive) setParticipants(resolved);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Member Mirror failed to load.');
      }
    }
    load();
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

  async function refresh() {
    setMirror(await loadMemberMirror(uid));
  }

  async function runProfileAction(action: 'hide' | 'unhide' | 'review') {
    if (!mirror?.member.profileDoc) return;
    const adminReason = window.prompt('Reason for this moderation action');
    if (!adminReason) return;
    setBusy(action);
    try {
      await setProfileModerationStatus(admin, mirror.member.profileDoc, action === 'hide' ? 'hidden' : action === 'unhide' ? 'visible' : 'under_review', adminReason);
      setNotice('Profile moderation status updated.');
      await refresh();
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
      await refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Profile delete failed.');
    } finally {
      setBusy(null);
    }
  }

  async function unlockMessages() {
    if (!mirror || !reason) return;
    setBusy('messages');
    try {
      await writeAdminAuditLog(admin, {
        action: 'VIEW_MEMBER_MIRROR_MESSAGES',
        reason,
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
  if (!mirror) return <EmptyState title="Loading Member Mirror" body="Gathering account, profile, requests, conversations, messages, and safety context." />;

  return (
    <>
      <AdminPageHeader
        title="Member Mirror"
        eyebrow="User 360"
        subtitle="View this member's profile, introductions, conversations, messages, and activity for support and trust & safety."
      >
        <Link href="/admin/users" className="admin-secondary">Back to directory</Link>
      </AdminPageHeader>
      {notice && <div className="mb-4 rounded-2xl border border-gold/30 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{notice}</div>}
      <div className="mb-5 rounded-2xl border border-gold/30 bg-maroon-deep px-5 py-4 text-sm font-semibold text-cream">
        Admin view only. This does not impersonate the member and does not allow sending messages as the member.
      </div>

      <div className="space-y-5">
        <IdentityCard member={mirror.member} busy={busy} runProfileAction={runProfileAction} openDeleteModal={() => setDeleteOpen(true)} />
        <HealthSummary mirror={mirror} />
        <ProfileMirror member={mirror.member} />
        <IntroductionsSection uid={uid} mirror={mirror} participants={participants} />
        <MatchesSection uid={uid} mirror={mirror} participants={participants} />
        <ConversationsSection uid={uid} mirror={mirror} participants={participants} />
        <MessagesSection uid={uid} mirror={mirror} participants={participants} reason={reason} setReason={setReason} unlocked={messagesUnlocked} busy={busy === 'messages'} unlock={unlockMessages} />
        <ActivitySections uid={uid} mirror={mirror} />
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

function IdentityCard({
  member,
  busy,
  runProfileAction,
  openDeleteModal,
}: {
  member: AdminMember;
  busy: string | null;
  runProfileAction: (action: 'hide' | 'unhide' | 'review') => void;
  openDeleteModal: () => void;
}) {
  return (
    <DataCard className="p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-maroon text-xl font-semibold text-cream">{member.initials}</span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-serif text-3xl font-semibold text-charcoal">{member.displayName}</h3>
              {member.isTestProfile && <StatusPill>Test profile</StatusPill>}
              <StatusPill tone={member.profileExists ? 'good' : 'warn'}>{member.profileExists ? 'Profile doc exists' : 'No profile doc'}</StatusPill>
              <StatusPill tone={member.userExists ? 'good' : 'warn'}>{member.userExists ? 'User doc exists' : 'No user doc'}</StatusPill>
            </div>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <p><span className="text-muted">UID:</span> <span className="font-mono">{shortId(member.uid)}</span></p>
              <p><span className="text-muted">Email:</span> {member.email || 'No email found'}</p>
              <p><span className="text-muted">Phone:</span> {member.phone || 'No phone found'}</p>
              <p><span className="text-muted">Location:</span> {formatValue(member.profileDoc?.data.city ?? member.userDoc?.data.city)}</p>
              <p><span className="text-muted">Age/gender:</span> {formatValue(member.profileDoc?.data.age)} / {formatValue(member.profileDoc?.data.gender)}</p>
              <p><span className="text-muted">Moderation:</span> {member.moderationStatus}</p>
              <p><span className="text-muted">Visible:</span> {member.isVisible == null ? 'Not set' : String(member.isVisible)}</p>
              <p><span className="text-muted">Created:</span> {formatDate(member.profileDoc?.data.createdAt ?? member.userDoc?.data.createdAt)}</p>
              <p><span className="text-muted">Updated:</span> {formatDate(member.profileDoc?.data.updatedAt ?? member.userDoc?.data.updatedAt)}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:w-56 lg:flex-col">
          <CopyButton value={member.uid} label="Copy UID" />
          <Link href={`/admin/profiles?search=${encodeURIComponent(member.uid)}`} className="admin-secondary">Open profile list</Link>
          <Link href={`/admin/conversations?search=${encodeURIComponent(member.uid)}`} className="admin-secondary">Open conversations</Link>
          {member.profileDoc && (
            <>
              <button disabled={busy === 'hide'} onClick={() => runProfileAction('hide')} className="admin-secondary">Hide profile</button>
              <button disabled={busy === 'unhide'} onClick={() => runProfileAction('unhide')} className="admin-secondary">Unhide profile</button>
              <button disabled={busy === 'review'} onClick={() => runProfileAction('review')} className="admin-secondary">Mark under review</button>
              <button disabled={busy === 'delete'} onClick={openDeleteModal} className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">Delete profile doc only</button>
            </>
          )}
        </div>
      </div>
      <RawJson data={{ user: member.userDoc?.data ?? null, profile: member.profileDoc?.data ?? null }} label="Technical details" />
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

function HealthSummary({ mirror }: { mirror: MemberMirrorData }) {
  const messages = Object.values(mirror.messagesByConversation).flat();
  const sent = messages.filter((message) => messageSenderId(message.data) === mirror.member.uid).length;
  const received = messages.length - sent;
  const photos = getArray(mirror.member.profileDoc?.data ?? {}, 'photos');

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MiniStat label="Profile health" value={mirror.member.profileExists ? 'Profile found' : 'Profile missing'} tone={mirror.member.profileExists ? 'good' : 'warn'} />
      <MiniStat label="Visibility" value={mirror.member.isVisible === false ? 'Hidden' : 'Visible or unset'} tone={mirror.member.isVisible === false ? 'danger' : 'good'} />
      <MiniStat label="Photos" value={photos.length ? `${photos.length} photos` : 'No photos'} tone={photos.length ? 'good' : 'warn'} />
      <MiniStat label="Moderation" value={mirror.member.moderationStatus} tone={mirror.member.moderationStatus.includes('under') ? 'warn' : 'neutral'} />
      <MiniStat label="Interests sent" value={String(mirror.introductionsSent.length)} />
      <MiniStat label="Interests received" value={String(mirror.introductionsReceived.length)} />
      <MiniStat label="Accepted matches" value={String(mirror.acceptedIntroductions.length)} />
      <MiniStat label="Conversations" value={String(mirror.conversations.length)} />
      <MiniStat label="Messages sent" value={String(sent)} />
      <MiniStat label="Messages received" value={String(received)} />
      <MiniStat label="Profile views sent" value={String(mirror.profileViewsSent.length)} />
      <MiniStat label="Profile views received" value={String(mirror.profileViewsReceived.length)} />
    </div>
  );
}

function MiniStat({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'good' | 'warn' | 'danger' }) {
  return (
    <DataCard className="p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-2 font-serif text-xl font-semibold text-charcoal">{value}</p>
      <div className="mt-2"><StatusPill tone={tone}>{tone === 'neutral' ? 'Available' : tone}</StatusPill></div>
    </DataCard>
  );
}

function ProfileMirror({ member }: { member: AdminMember }) {
  const profile = member.profileDoc?.data;
  if (!profile) return <EmptyState title="No public profile document" body="The account exists without a completed profile document." />;
  const missing = ['bio', 'lookingFor', 'family', 'education', 'profession', 'city', 'height'].filter((field) => !profile[field]);

  return (
    <DataCard className="p-5">
      <h3 className="font-serif text-2xl font-semibold text-charcoal">Profile mirror</h3>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <TextBlock title="About" body={formatValue(profile.bio ?? profile.about)} />
        <TextBlock title="Looking for" body={formatValue(profile.lookingFor)} />
        <TextBlock title="Family background" body={formatValue(profile.family ?? profile.familyBackground)} />
      </div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <p><span className="text-muted">Education:</span> {formatValue(profile.education)}</p>
        <p><span className="text-muted">Career:</span> {formatValue(profile.profession)}</p>
        <p><span className="text-muted">Lifestyle:</span> {formatValue(profile.lifestyle)}</p>
        <p><span className="text-muted">Traits:</span> {formatValue(profile.traits)}</p>
        <p><span className="text-muted">Premium:</span> {String(Boolean(profile.isPremium))}</p>
        <p><span className="text-muted">Concierge:</span> {String(Boolean(profile.isConcierge))}</p>
        <p><span className="text-muted">Quality:</span> {formatValue(profile.profileQuality ?? profile.profileCompletion)}</p>
        <p><span className="text-muted">Missing fields:</span> {missing.length ? missing.join(', ') : 'None from core profile'}</p>
      </div>
    </DataCard>
  );
}

function TextBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-line bg-ivory p-4">
      <p className="font-semibold text-charcoal">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink/75">{body}</p>
    </div>
  );
}

function IntroductionsSection({ uid, mirror, participants }: { uid: string; mirror: MemberMirrorData; participants: Record<string, ParticipantInfo> }) {
  return (
    <DataCard className="p-5">
      <h3 className="font-serif text-2xl font-semibold text-charcoal">Introductions and requests</h3>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <IntroColumn title="Sent by this member" uid={uid} docs={mirror.introductionsSent} participants={participants} />
        <IntroColumn title="Received by this member" uid={uid} docs={mirror.introductionsReceived} participants={participants} />
      </div>
    </DataCard>
  );
}

function IntroColumn({ title, uid, docs, participants }: { title: string; uid: string; docs: AdminDoc[]; participants: Record<string, ParticipantInfo> }) {
  if (docs.length === 0) return <EmptyState title={title} body="No requests found in this direction." />;
  return (
    <div>
      <h4 className="font-semibold text-charcoal">{title}</h4>
      <div className="mt-3 space-y-3">
        {docs.map((intro) => {
          const sender = getString(intro.data, ['senderId', 'fromUserId', 'fromUid']);
          const recipient = getString(intro.data, ['recipientId', 'toUserId', 'toUid']);
          const otherUid = sender === uid ? recipient : sender;
          const other = participants[otherUid];
          return (
            <div key={intro.id} className="rounded-2xl border border-line bg-ivory p-4">
              <p className="font-semibold text-charcoal">{sender === uid ? `This member sent interest to ${other?.displayName ?? shortId(otherUid)}` : `${other?.displayName ?? shortId(otherUid)} sent interest to this member`}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusPill>{formatValue(intro.data.status)}</StatusPill>
                <StatusPill>{formatDate(intro.data.createdAt ?? intro.data.sentAt)}</StatusPill>
              </div>
              {formatValue(intro.data.note ?? intro.data.message) !== '—' && <p className="mt-2 text-sm text-muted">{formatValue(intro.data.note ?? intro.data.message)}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {otherUid && <Link className="admin-secondary" href={`/admin/users/${otherUid}`}>Open other member</Link>}
                {typeof intro.data.conversationId === 'string' && <Link className="admin-secondary" href={`/admin/conversations/${intro.data.conversationId}`}>Open conversation</Link>}
                <CopyButton value={intro.id} label="Copy introduction ID" />
              </div>
              <RawJson data={intro.data} label="Technical details" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MatchesSection({ uid, mirror, participants }: { uid: string; mirror: MemberMirrorData; participants: Record<string, ParticipantInfo> }) {
  if (mirror.acceptedIntroductions.length === 0) return <EmptyState title="Accepted matches" body="No accepted introductions or match records were found for this member." />;
  return (
    <DataCard className="p-5">
      <h3 className="font-serif text-2xl font-semibold text-charcoal">Accepted matches</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {mirror.acceptedIntroductions.map((intro) => {
          const sender = getString(intro.data, ['senderId', 'fromUserId', 'fromUid']);
          const recipient = getString(intro.data, ['recipientId', 'toUserId', 'toUid']);
          const otherUid = sender === uid ? recipient : sender;
          return (
            <div key={intro.id} className="rounded-2xl border border-line bg-ivory p-4">
              <p className="font-semibold text-charcoal">{participants[otherUid]?.displayName ?? shortId(otherUid)}</p>
              <p className="mt-1 text-sm text-muted">Accepted {formatDate(intro.data.respondedAt ?? intro.data.updatedAt ?? intro.data.createdAt)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {typeof intro.data.conversationId === 'string' && <Link className="admin-secondary" href={`/admin/conversations/${intro.data.conversationId}`}>Open conversation</Link>}
                {otherUid && <Link className="admin-secondary" href={`/admin/users/${otherUid}`}>Open other member</Link>}
              </div>
            </div>
          );
        })}
      </div>
    </DataCard>
  );
}

function ConversationsSection({ uid, mirror, participants }: { uid: string; mirror: MemberMirrorData; participants: Record<string, ParticipantInfo> }) {
  if (mirror.conversations.length === 0) return <EmptyState title="Conversations" body="No conversations involving this UID were found." />;
  return (
    <DataCard className="p-5">
      <h3 className="font-serif text-2xl font-semibold text-charcoal">Conversations</h3>
      <div className="mt-4 space-y-3">
        {mirror.conversations.map((conversation) => {
          const participantUids = participantUidsFromConversation(conversation.data);
          const others = participantUids.filter((id) => id !== uid);
          const messages = mirror.messagesByConversation[conversation.id] ?? [];
          return (
            <div key={conversation.id} className="rounded-2xl border border-line bg-ivory p-4">
              <p className="font-semibold text-charcoal">{others.map((id) => participants[id]?.displayName ?? shortId(id)).join(', ') || 'Conversation participants'}</p>
              <p className="mt-1 text-sm text-muted">Conversation {shortId(conversation.id)} · {messages.length} messages loaded</p>
              <p className="mt-2 text-sm text-ink/75">{formatValue(conversation.data.lastMessage)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/admin/conversations/${conversation.id}`} className="admin-primary">Review conversation</Link>
                <CopyButton value={conversation.id} label="Copy conversation ID" />
              </div>
            </div>
          );
        })}
      </div>
    </DataCard>
  );
}

function MessagesSection({
  uid,
  mirror,
  participants,
  reason,
  setReason,
  unlocked,
  busy,
  unlock,
}: {
  uid: string;
  mirror: MemberMirrorData;
  participants: Record<string, ParticipantInfo>;
  reason: string;
  setReason: (value: string) => void;
  unlocked: boolean;
  busy: boolean;
  unlock: () => void;
}) {
  const messages = useMemo(() => {
    return Object.entries(mirror.messagesByConversation).flatMap(([conversationId, docs]) => docs.map((message) => ({ conversationId, message })));
  }, [mirror.messagesByConversation]);

  return (
    <DataCard className="p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="font-serif text-2xl font-semibold text-charcoal">Member messages</h3>
          <p className="mt-1 text-sm text-muted">Messages sent or received by this member are shown only after an audit log is written.</p>
        </div>
        {unlocked && <StatusPill tone="good">Access logged</StatusPill>}
      </div>

      {!unlocked ? (
        <div className="mt-5 rounded-2xl border border-gold/30 bg-ivory p-4">
          <p className="font-semibold text-charcoal">Reason for viewing this member's messages</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ACCESS_REASONS.map((item) => (
              <button key={item} onClick={() => setReason(item)} className={`rounded-full px-4 py-2 text-sm font-semibold ${reason === item ? 'bg-maroon text-cream' : 'border border-line bg-cream text-muted hover:border-gold'}`}>
                {item}
              </button>
            ))}
          </div>
          <button disabled={!reason || busy} onClick={unlock} className="admin-primary mt-4">
            {busy ? 'Writing audit log...' : 'Write audit log and view messages'}
          </button>
        </div>
      ) : messages.length === 0 ? (
        <EmptyState title="No messages found" />
      ) : (
        <div className="mt-5 space-y-4">
          {messages.map(({ conversationId, message }, index) => {
            const senderId = messageSenderId(message.data);
            const sentByMember = senderId === uid;
            const previous = messages[index - 1]?.message;
            const heading = formatDateHeading(messageTimestamp(message.data));
            const showHeading = !previous || formatDateHeading(messageTimestamp(previous.data)) !== heading;
            const conversation = mirror.conversations.find((item) => item.id === conversationId);
            const otherUid = participantUidsFromConversation(conversation?.data ?? {}).find((id) => id !== uid) ?? '';
            return (
              <div key={`${conversationId}:${message.id}`}>
                {showHeading && <p className="my-4 text-center text-xs font-semibold uppercase tracking-[0.14em] text-muted">{heading}</p>}
                <div className={`rounded-2xl border p-4 ${sentByMember ? 'border-maroon/20 bg-maroon text-cream' : 'border-line bg-ivory text-ink'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{sentByMember ? 'Sent by member' : 'Received by member'}</p>
                    <p className={`text-xs ${sentByMember ? 'text-cream/70' : 'text-muted'}`}>{formatTime(messageTimestamp(message.data))}</p>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{messageText(message.data)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusPill>{participants[otherUid]?.displayName ?? shortId(otherUid || 'other member')}</StatusPill>
                    {isMessageDeleted(message.data) && <StatusPill tone="danger">Deleted</StatusPill>}
                    <Link href={`/admin/conversations/${conversationId}`} className="admin-secondary">Open conversation</Link>
                  </div>
                  <RawJson data={message.data} label="Technical details" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DataCard>
  );
}

function ActivitySections({ uid, mirror }: { uid: string; mirror: MemberMirrorData }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <SimpleDocSection title="Profile views" empty="Profile view tracking is not available or no views were found." docs={[...mirror.profileViewsSent, ...mirror.profileViewsReceived]} uid={uid} />
      <SimpleDocSection title="Notifications and activity" empty="No notifications were found for this member." docs={mirror.notifications} uid={uid} />
      <SimpleDocSection title="Reports and moderation" empty="No reports involving this member were found." docs={[...mirror.reportsByUser, ...mirror.reportsAgainstUser]} uid={uid} />
      <DataCard className="p-5">
        <h3 className="font-serif text-2xl font-semibold text-charcoal">Premium waitlist</h3>
        {mirror.waitlist ? <RawJson data={mirror.waitlist.data} label="Waitlist details" /> : <p className="mt-3 text-sm text-muted">No premium waitlist document was found.</p>}
      </DataCard>
      <SimpleDocSection title="Admin audit for this member" empty="No admin audit logs found for this UID." docs={mirror.auditLogs} uid={uid} />
      {Object.keys(mirror.sectionErrors).length > 0 && (
        <DataCard className="p-5">
          <h3 className="font-serif text-2xl font-semibold text-charcoal">Section load notes</h3>
          <div className="mt-3 space-y-2 text-sm text-muted">
            {Object.entries(mirror.sectionErrors).map(([section, message]) => <p key={section}><span className="font-semibold text-charcoal">{section}:</span> {message}</p>)}
          </div>
        </DataCard>
      )}
    </div>
  );
}

function SimpleDocSection({ title, empty, docs, uid }: { title: string; empty: string; docs: AdminDoc[]; uid: string }) {
  return (
    <DataCard className="p-5">
      <h3 className="font-serif text-2xl font-semibold text-charcoal">{title}</h3>
      {docs.length === 0 ? <p className="mt-3 text-sm text-muted">{empty}</p> : (
        <div className="mt-4 space-y-3">
          {docs.slice(0, 20).map((doc) => (
            <div key={doc.id} className="rounded-2xl border border-line bg-ivory p-4">
              <p className="font-semibold text-charcoal">{formatValue(doc.data.title ?? doc.data.type ?? doc.data.action ?? doc.data.reason ?? doc.id)}</p>
              <p className="mt-1 text-sm text-muted">{formatDate(doc.data.createdAt ?? doc.data.updatedAt ?? doc.data.timestamp)}</p>
              <p className="mt-1 font-mono text-xs text-muted">{doc.id === uid ? shortId(uid) : shortId(doc.id)}</p>
              <RawJson data={doc.data} label="Technical details" />
            </div>
          ))}
        </div>
      )}
    </DataCard>
  );
}
