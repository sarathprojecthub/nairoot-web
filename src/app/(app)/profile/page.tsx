'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  FieldLabel, Hint, TextField, TextArea, ChipGroup, PrimaryButton,
} from '@/components/onboarding/fields';
import {
  EDUCATION_OPTIONS, MARITAL_OPTIONS, INCOME_OPTIONS, STATES, MAX_PHOTOS,
} from '@/lib/onboarding/options';
import {
  fetchEditableProfile, saveProfileEdits, setProfileVisibility, type LoadedProfile,
} from '@/lib/profileEdit';
import { uploadUserPhoto, isCloudinaryConfigured } from '@/lib/cloudinary';

const MARITAL_LABELS = MARITAL_OPTIONS.map((o) => o.label);
const maritalValue = (label: string) => MARITAL_OPTIONS.find((o) => o.label === label)?.value ?? '';

export default function ProfileEditPage() {
  const router = useRouter();
  const { uid, isOnboarded, loading } = useCurrentUser();
  const [profile, setProfile] = useState<LoadedProfile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Gate: must be a completed member to edit.
  useEffect(() => {
    if (loading || !uid) return;
    if (!isOnboarded) { router.replace('/onboarding'); return; }
    fetchEditableProfile(uid).then((p) => { if (p) setProfile(p); else setNotFound(true); });
  }, [loading, uid, isOnboarded, router]);

  const set = useCallback(<K extends keyof LoadedProfile>(k: K, v: LoadedProfile[K]) => {
    setProfile((prev) => (prev ? { ...prev, [k]: v } : prev));
  }, []);

  const flashMsg = useCallback((m: string) => { setFlash(m); setTimeout(() => setFlash(null), 3000); }, []);

  async function save() {
    if (!uid || !profile) return;
    setSaving(true);
    try {
      await saveProfileEdits(uid, profile);
      flashMsg('Saved');
    } catch (e) {
      flashMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleVisibility() {
    if (!uid || !profile) return;
    const next = !profile.isVisible;
    try {
      await setProfileVisibility(uid, next);
      set('isVisible', next);
      flashMsg(next ? 'Profile is now visible' : 'Profile hidden from Discover');
    } catch {
      flashMsg('Could not update visibility');
    }
  }

  async function addPhoto(file: File) {
    if (!uid || !profile || profile.photos.length >= MAX_PHOTOS) return;
    const index = profile.photos.length;
    setUploadingSlot(index);
    try {
      const url = await uploadUserPhoto(file, uid, index);
      const photos = [...profile.photos, url];
      set('photos', photos);
      await saveProfileEdits(uid, { ...profile, photos });
      flashMsg('Photo added');
    } catch (e) {
      flashMsg(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadingSlot(null);
    }
  }

  async function removePhoto(i: number) {
    if (!uid || !profile) return;
    const photos = profile.photos.filter((_, idx) => idx !== i);
    set('photos', photos);
    await saveProfileEdits(uid, { ...profile, photos });
    flashMsg('Photo removed');
  }

  if (loading || (!profile && !notFound)) {
    return <div className="flex min-h-[50vh] items-center justify-center text-stone-400">Loading…</div>;
  }
  if (notFound) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-stone-600">You don’t have a profile yet.</p>
        <button onClick={() => router.replace('/onboarding')} className="mt-4 rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-cream">
          Complete onboarding
        </button>
      </div>
    );
  }
  if (!profile) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-charcoal">Edit profile</h1>
          <p className="text-sm text-muted">Changes appear in Discover for Android and Website users.</p>
        </div>
        <button
          onClick={toggleVisibility}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            profile.isVisible ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-ivory-deep text-ink/70 hover:bg-line-strong'
          }`}
        >
          {profile.isVisible ? '● Visible' : '○ Hidden'}
        </button>
      </div>

      {/* Photos */}
      <section className="mb-8">
        <FieldLabel>Photos</FieldLabel>
        <div className="grid grid-cols-3 gap-3 sm:max-w-md">
          {profile.photos.map((url, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Photo ${i + 1}`} className={`aspect-[4/5] w-full rounded-xl object-cover ${i === 0 ? 'ring-2 ring-gold' : ''}`} />
              <button onClick={() => removePhoto(i)} className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-xs text-white" aria-label="Remove photo">✕</button>
            </div>
          ))}
          {profile.photos.length < MAX_PHOTOS && (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={!isCloudinaryConfigured() || uploadingSlot !== null}
              className="flex aspect-[4/5] items-center justify-center rounded-xl border border-dashed border-line-strong text-muted hover:border-gold/50 disabled:opacity-40"
            >
              {uploadingSlot !== null ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-line-strong border-t-maroon" /> : '＋'}
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void addPhoto(f); e.target.value = ''; }} />
        {!isCloudinaryConfigured() && <Hint>Photo upload is not configured (Cloudinary env not set).</Hint>}
      </section>

      {/* Fields */}
      <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
        <div>
          <FieldLabel>Full name</FieldLabel>
          <TextField value={profile.name} onChange={(v) => set('name', v)} placeholder="Your name" />
        </div>
        <div>
          <FieldLabel>Height</FieldLabel>
          <TextField value={profile.height} onChange={(v) => set('height', v)} placeholder={`e.g. 5'6"`} />
        </div>
        <div>
          <FieldLabel>City / District</FieldLabel>
          <TextField value={profile.city} onChange={(v) => set('city', v)} placeholder="e.g. Kochi" />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel>State</FieldLabel>
          <ChipGroup options={STATES} value={profile.state} onChange={(v) => set('state', v)} />
        </div>
        <div>
          <FieldLabel>Occupation</FieldLabel>
          <TextField value={profile.profession} onChange={(v) => set('profession', v)} placeholder="e.g. Software Engineer" />
        </div>
        <div>
          <FieldLabel>Mother tongue</FieldLabel>
          <TextField value={profile.motherTongue} onChange={(v) => set('motherTongue', v)} placeholder="e.g. Malayalam" />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel>Education</FieldLabel>
          <ChipGroup options={EDUCATION_OPTIONS} value={profile.education} onChange={(v) => set('education', v)} />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel>Marital status</FieldLabel>
          <ChipGroup
            options={MARITAL_LABELS}
            value={MARITAL_OPTIONS.find((o) => o.value === profile.maritalStatus)?.label ?? ''}
            onChange={(label) => set('maritalStatus', maritalValue(label))}
          />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel optional>Annual income</FieldLabel>
          <ChipGroup options={INCOME_OPTIONS} value={profile.income} onChange={(v) => set('income', v)} toggleable />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel>About you</FieldLabel>
          <TextArea value={profile.bio} onChange={(v) => set('bio', v)} maxLength={300} rows={5} placeholder="A few honest lines about who you are…" />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel optional>Family</FieldLabel>
          <TextArea value={profile.family} onChange={(v) => set('family', v)} maxLength={280} rows={3} placeholder="A short note about your family…" />
        </div>
      </div>

      <div className="sticky bottom-0 mt-8 flex items-center gap-3 border-t border-line bg-ivory/90 py-4 backdrop-blur">
        <div className="w-40"><PrimaryButton onClick={save} loading={saving}>Save changes</PrimaryButton></div>
        {flash && <span className="text-sm text-emerald-600">{flash}</span>}
      </div>
    </div>
  );
}
