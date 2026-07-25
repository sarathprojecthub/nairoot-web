'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { ensureAuth } from '@/lib/profiles';
import { fetchUser } from '@/lib/user';
import { logout } from '@/lib/auth';
import { INITIAL_ONBOARDING_DATA, deriveFromCreatingFor } from '@/lib/onboarding/data';
import type { OnboardingData } from '@/lib/onboarding/data';
import { loadOnboardingDraft, saveOnboardingDraft, type OnboardingDraft } from '@/lib/onboarding/draft';
import { completeProfile } from '@/lib/onboarding/complete';
import {
  BIO_MAX_CHARS, BIO_STARTERS, CITY_OPTIONS_BY_STATE, CREATING_FOR_OPTIONS,
  EDUCATION_PROFILE_OPTIONS, EMPLOYMENT_OPTIONS, FAMILY_TYPE_OPTIONS,
  HEIGHT_OPTIONS, HOROSCOPE_OPTIONS, INCOME_PROFILE_OPTIONS,
  MARITAL_OPTIONS, MAX_FAMILY_DESC, MOTHER_TONGUE_OPTIONS, NAKSHATRA_OPTIONS,
  OCCUPATION_PROFILE_OPTIONS, PARENT_OCCUPATION_OPTIONS, SIBLING_COUNTS,
  STATE_OPTIONS, SUBCASTE_OPTIONS, type AgeRangePreference, type CreatingFor,
  type EmploymentType, type FamilyType, type Gender, type HoroscopePreference,
  type MaritalStatus, type ProfileOption, type Religion,
} from '@/lib/onboarding/options';
import {
  ageFromIso, compactProfileText, profileCompletion, validateProfile,
  type ProfileSectionId, type ProfileValidationError,
} from '@/lib/onboarding/profileValidation';
import { ProfileCombobox } from './ProfileCombobox';
import { ProfilePhotoManager } from './ProfilePhotoManager';

type Errors = Partial<Record<ProfileValidationError['field'], string>>;
type SaveState = 'idle' | 'saving' | 'saved' | 'submitting';

const employmentProfileOptions: ProfileOption[] = EMPLOYMENT_OPTIONS.map((option) => ({ value: option.value, label: option.label }));
const maritalProfileOptions: ProfileOption[] = MARITAL_OPTIONS.map((option) => ({ value: option.value, label: option.label }));
const horoscopeProfileOptions: ProfileOption[] = HOROSCOPE_OPTIONS.map((option) => ({ value: option.value, label: option.label }));
const familyProfileOptions: ProfileOption[] = FAMILY_TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label }));
const siblingProfileOptions: ProfileOption[] = SIBLING_COUNTS.map((value) => ({ value, label: value }));

function hydrateDraft(draft: OnboardingDraft): OnboardingData {
  const base = INITIAL_ONBOARDING_DATA;
  return {
    creatingFor: (draft.creatingFor as CreatingFor | '') ?? base.creatingFor,
    name: draft.name ?? base.name,
    dob: draft.dob ?? base.dob,
    age: draft.age ?? base.age,
    height: draft.height ?? base.height,
    maritalStatus: (draft.maritalStatus as MaritalStatus | '') ?? base.maritalStatus,
    motherTongue: draft.motherTongue ?? base.motherTongue,
    subcaste: draft.subcaste ?? base.subcaste,
    star: draft.star ?? base.star,
    horoscopePreference: (draft.horoscopePreference as HoroscopePreference | '') ?? base.horoscopePreference,
    state: draft.state ?? base.state,
    city: draft.city ?? base.city,
    education: draft.education ?? base.education,
    employmentType: (draft.employmentType as EmploymentType | '') ?? base.employmentType,
    profession: draft.profession ?? base.profession,
    income: draft.income ?? base.income,
    familyType: (draft.familyType as FamilyType | '') ?? base.familyType,
    familyDescription: draft.familyDescription ?? base.familyDescription,
    fatherOccupation: draft.fatherOccupation ?? base.fatherOccupation,
    motherOccupation: draft.motherOccupation ?? base.motherOccupation,
    brothers: draft.brothers ?? base.brothers,
    sisters: draft.sisters ?? base.sisters,
    bio: draft.bio ?? base.bio,
    promptQuestion: draft.promptQuestion ?? base.promptQuestion,
    promptAnswer: draft.promptAnswer ?? base.promptAnswer,
    photos: Array.isArray(draft.photos) ? draft.photos : base.photos,
    gender: (draft.gender as Gender | '') ?? base.gender,
    religion: (draft.religion as Religion) ?? base.religion,
    lookingFor: {
      gender: (draft.lookingForGender as Gender | 'any') ?? base.lookingFor.gender,
      ageRange: (draft.lookingForAgeRange as AgeRangePreference) ?? base.lookingFor.ageRange,
    },
  };
}

function FieldLabel({ children, required, optional, htmlFor }: { children: ReactNode; required?: boolean; optional?: boolean; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="mb-2 block text-xs font-semibold text-charcoal">{children}{required && <span className="text-maroon"> *</span>}{optional && <span className="font-normal text-muted"> (optional)</span>}</label>;
}

function TextField({ id, label, value, onChange, required, optional, error, type = 'text' }: {
  id: string; label: string; value: string; onChange: (value: string) => void;
  required?: boolean; optional?: boolean; error?: string; type?: string;
}) {
  return (
    <div>
      <FieldLabel htmlFor={id} required={required} optional={optional}>{label}</FieldLabel>
      <input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)}
        aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
        className={`min-h-12 w-full rounded-xl border bg-cream px-4 py-3 text-sm text-ink outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/20 ${error ? 'border-red-500' : 'border-line-strong'}`} />
      {error && <p id={`${id}-error`} className="mt-1.5 text-xs text-red-700">{error}</p>}
    </div>
  );
}

function SectionCard({ id, title, helper, summary, icon, open, complete, error, onToggle, children }: {
  id: ProfileSectionId; title: string; helper: string; summary?: string; icon: string;
  open: boolean; complete: boolean; error?: string; onToggle: () => void; children: ReactNode;
}) {
  return (
    <section id={`section-${id}`} className={`scroll-mt-5 overflow-hidden rounded-2xl border bg-cream shadow-soft ${error ? 'border-red-300' : 'border-line'}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`section-${id}-content`} className="flex min-h-20 w-full items-center gap-4 px-5 py-4 text-left sm:px-6">
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-maroon text-lg text-gold-soft">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.08em] text-charcoal">{title}{complete && <span className="text-maroon" aria-label="Complete">✓</span>}</span>
          <span className={`mt-1 block truncate text-xs ${error ? 'text-red-700' : 'text-muted'}`}>{error || summary || helper}</span>
        </span>
        <span aria-hidden className="text-gold">{open ? '⌃' : '⌄'}</span>
      </button>
      {open && <div id={`section-${id}-content`} className="border-t border-line px-5 py-6 sm:px-6">{children}</div>}
    </section>
  );
}

export function OnePageProfileForm() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [data, setData] = useState(INITIAL_ONBOARDING_DATA);
  const [booting, setBooting] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [submitError, setSubmitError] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [photoPending, setPhotoPending] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [open, setOpen] = useState<Record<ProfileSectionId, boolean>>({
    photos: true, about: true, background: false, location: false, work: false, family: false, bio: false,
  });
  const hydrated = useRef(false);
  const autosaveTimer = useRef<number | null>(null);
  const completion = useMemo(() => profileCompletion(data), [data]);
  const currentValidation = useMemo(() => validateProfile(data), [data]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const authUser = await ensureAuth();
        if (cancelled) return;
        const [existing, draft] = await Promise.all([
          fetchUser(authUser.uid).catch(() => null),
          loadOnboardingDraft(authUser.uid).catch(() => null),
        ]);
        if (cancelled) return;
        if (existing?.isOnboarded) { router.replace('/discover'); return; }
        setUid(authUser.uid);
        if (draft) setData(hydrateDraft(draft));
        hydrated.current = true;
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    if (!uid || !hydrated.current) return;
    setSaveState('saving');
    autosaveTimer.current = window.setTimeout(() => {
      void saveOnboardingDraft(uid, data, 1)
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('idle'));
    }, 700);
    return () => {
      if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current);
    };
  }, [data, uid]);

  function update(patch: Partial<OnboardingData>) {
    setData((previous) => ({ ...previous, ...patch }));
    setSubmitError('');
    if (submitted) {
      const next = { ...data, ...patch };
      setErrors(Object.fromEntries(validateProfile(next).map((error) => [error.field, error.message])));
    }
  }

  function sectionError(section: ProfileSectionId): string | undefined {
    if (section === 'photos' && errors.photos) return errors.photos;
    return currentValidation.find((error) => error.section === section && errors[error.field])?.message;
  }

  function sectionComplete(section: ProfileSectionId): boolean {
    if (section === 'background') return true;
    if (section === 'photos' && photoFailed) return false;
    return !currentValidation.some((error) => error.section === section);
  }

  async function submit() {
    if (!uid || saveState === 'submitting' || photoPending) {
      if (photoPending) setSubmitError('Finish or remove the pending photo upload before creating your profile.');
      return;
    }
    setSubmitted(true);
    setSubmitError('');
    const problems = validateProfile(data);
    if (photoFailed) {
      const failedPhotoMessage = 'Remove the failed photo and try uploading it again.';
      const existingPhotoProblem = problems.find((problem) => problem.field === 'photos');
      if (existingPhotoProblem) existingPhotoProblem.message = failedPhotoMessage;
      else {
        problems.unshift({
          field: 'photos',
          section: 'photos',
          message: failedPhotoMessage,
        });
      }
    }
    setErrors(Object.fromEntries(problems.map((error) => [error.field, error.message])));
    if (problems.length) {
      const first = problems[0];
      setOpen((previous) => ({ ...previous, [first.section]: true }));
      requestAnimationFrame(() => {
        document.getElementById(`section-${first.section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.setTimeout(() => {
          const fallback = first.field === 'photos'
            ? document.querySelector<HTMLElement>('#section-photos [data-photo-add], #section-photos button[aria-label^="Remove photo"]')
            : first.field === 'creatingFor'
              ? document.querySelector<HTMLElement>('#creatingFor button')
              : null;
          (fallback ?? document.getElementById(first.field))?.focus();
        }, 350);
      });
      return;
    }
    setSaveState('submitting');
    if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current);
    try {
      await completeProfile(uid, {
        ...data,
        name: compactProfileText(data.name),
        city: compactProfileText(data.city),
        profession: compactProfileText(data.profession),
        familyDescription: compactProfileText(data.familyDescription),
        bio: compactProfileText(data.bio),
      });
      router.replace('/discover');
    } catch {
      setSaveState('idle');
      setSubmitError('We could not create your profile just now. Your details are still saved—please try again.');
    }
  }

  async function signOut() {
    await logout();
    router.replace('/login');
  }

  if (booting || !uid) return <div className="flex min-h-screen items-center justify-center bg-ivory"><span className="h-7 w-7 animate-spin rounded-full border-2 border-line-strong border-t-maroon" /></div>;

  return (
    <main className="min-h-screen bg-ivory text-ink">
      <div className="mx-auto grid min-h-screen max-w-[1440px] lg:grid-cols-[minmax(290px,36%)_1fr]">
        <aside className="border-b border-maroon/20 bg-maroon px-5 py-6 text-cream lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:px-10 lg:py-10 xl:px-14">
          <div className="flex items-center justify-between lg:block">
            <div className="flex items-center gap-3"><BrandLogo className="h-9 w-9" /><span className="font-serif text-base font-semibold tracking-wide">The Nair Root</span></div>
            <button type="button" onClick={signOut} className="min-h-11 rounded-full border border-cream/25 px-4 text-xs font-semibold hover:bg-cream/10">Sign out</button>
          </div>
          <div className="mt-7 lg:mt-20">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-soft">A thoughtful beginning</p>
            <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight lg:text-5xl">Create your profile</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-cream/75">A clear, genuine profile helps families understand the person behind the details.</p>
          </div>
          <div className="mt-6 rounded-2xl border border-cream/15 bg-cream/10 p-4 lg:mt-10 lg:p-5">
            <div className="flex items-center justify-between text-sm"><span>Profile completion</span><strong>{completion}%</strong></div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-cream/15" role="progressbar" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100} aria-label={`${completion}% profile complete`}>
              <div className="h-full rounded-full bg-gold-soft transition-[width] motion-reduce:transition-none" style={{ width: `${completion}%` }} />
            </div>
            <p aria-live="polite" className="mt-4 text-xs text-cream/65">{saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Your progress saves automatically'}</p>
          </div>
          <p className="mt-5 flex items-center gap-2 text-xs text-cream/65"><span aria-hidden>◇</span>Your contact information stays private.</p>
        </aside>

        <div className="min-w-0 px-4 py-7 pb-32 sm:px-8 lg:px-10 lg:py-12 xl:px-16">
          <div className="mx-auto max-w-3xl">
            <header className="mb-7 lg:hidden">
              <p className="font-serif text-2xl font-semibold text-charcoal">Tell us about yourself</p>
              <p className="mt-2 text-sm text-muted">Complete each section at your own pace.</p>
            </header>
            <div className="space-y-4">
              <SectionCard id="photos" title="Profile Photos" icon="◇" helper="Add one clear primary photo." summary={`${data.photos.length} photo${data.photos.length === 1 ? '' : 's'} added`} open={open.photos} complete={sectionComplete('photos')} error={sectionError('photos')} onToggle={() => setOpen((state) => ({ ...state, photos: !state.photos }))}>
                <div id="photos" tabIndex={-1} aria-invalid={!!errors.photos} aria-describedby={errors.photos ? 'photos-error' : undefined}>
                  <ProfilePhotoManager uid={uid} photos={data.photos} onChange={(photos) => update({ photos })} onPendingChange={setPhotoPending} onFailedChange={setPhotoFailed} error={errors.photos} />
                </div>
              </SectionCard>

              <SectionCard id="about" title="About You" icon="○" helper="Identity and life-stage details." summary={[data.name, data.height].filter(Boolean).join(' · ')} open={open.about} complete={sectionComplete('about')} error={sectionError('about')} onToggle={() => setOpen((state) => ({ ...state, about: !state.about }))}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <FieldLabel required>Profile is for</FieldLabel>
                    <div id="creatingFor" role="group" aria-describedby={errors.creatingFor ? 'creatingFor-error' : undefined} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {CREATING_FOR_OPTIONS.map((option) => <button key={option.value} type="button" aria-pressed={data.creatingFor === option.value} onClick={() => update({ creatingFor: option.value, ...deriveFromCreatingFor(option.gender) })} className={`min-h-14 rounded-xl border px-3 py-2 text-left text-sm ${data.creatingFor === option.value ? 'border-maroon bg-maroon text-cream' : 'border-line-strong bg-ivory hover:border-gold'}`}><strong className="block">{option.label}</strong><span className="text-[11px] opacity-75">{option.sub}</span></button>)}
                    </div>
                    {errors.creatingFor && <p id="creatingFor-error" className="mt-1 text-xs text-red-700">{errors.creatingFor}</p>}
                  </div>
                  <TextField id="name" label="Full name" required value={data.name} onChange={(name) => update({ name })} error={errors.name} />
                  <div>
                    <FieldLabel htmlFor="dob" required>Date of birth</FieldLabel>
                    <input id="dob" type="date" value={data.dob} onChange={(event) => { const dob = event.target.value; update({ dob, age: ageFromIso(dob) }); }} aria-invalid={!!errors.dob} aria-describedby={errors.dob ? 'dob-error' : undefined} className={`min-h-12 w-full rounded-xl border bg-cream px-4 py-3 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-maroon/20 ${errors.dob ? 'border-red-500' : 'border-line-strong'}`} />
                    {data.age > 0 && <p className="mt-1 text-xs text-muted">Age: {data.age} years</p>}{errors.dob && <p id="dob-error" className="mt-1 text-xs text-red-700">{errors.dob}</p>}
                  </div>
                  <ProfileCombobox id="height" label="Height" required value={data.height} options={HEIGHT_OPTIONS} onChange={(height) => update({ height })} error={errors.height} />
                  <ProfileCombobox id="maritalStatus" label="Marital status" required value={data.maritalStatus} options={maritalProfileOptions} onChange={(maritalStatus) => update({ maritalStatus: maritalStatus as MaritalStatus })} error={errors.maritalStatus} />
                  <div className="sm:col-span-2"><ProfileCombobox id="motherTongue" label="Mother tongue" required value={data.motherTongue} options={MOTHER_TONGUE_OPTIONS} allowManual onChange={(motherTongue) => update({ motherTongue })} error={errors.motherTongue} /></div>
                </div>
              </SectionCard>

              <SectionCard id="background" title="Background" icon="⌂" helper="Cultural details, shared thoughtfully." summary={['Hindu', 'Nair', data.subcaste].filter(Boolean).join(' · ')} open={open.background} complete error={undefined} onToggle={() => setOpen((state) => ({ ...state, background: !state.background }))}>
                <p className="mb-5 rounded-xl border border-gold/25 bg-gold/5 px-4 py-3 text-xs text-muted">The Nair Root currently serves the Nair community.</p>
                <div className="mb-5 grid grid-cols-2 gap-3"><div className="rounded-xl border border-line bg-ivory p-4"><span className="block text-xs text-muted">Religion</span><strong className="mt-1 block text-sm">Hindu</strong></div><div className="rounded-xl border border-line bg-ivory p-4"><span className="block text-xs text-muted">Community</span><strong className="mt-1 block text-sm">Nair</strong></div></div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2"><ProfileCombobox label="Subcaste" optional value={data.subcaste} options={SUBCASTE_OPTIONS} allowManual allowClear onChange={(subcaste) => update({ subcaste })} /></div>
                  <ProfileCombobox label="Birth star (Nakshatra)" optional value={data.star} options={NAKSHATRA_OPTIONS} allowClear onChange={(star) => update({ star })} />
                  <ProfileCombobox label="Horoscope preference" optional value={data.horoscopePreference} options={horoscopeProfileOptions} allowClear onChange={(horoscopePreference) => update({ horoscopePreference: horoscopePreference as HoroscopePreference | '' })} />
                </div>
              </SectionCard>

              <SectionCard id="location" title="Location" icon="⌖" helper="Where you live and build your daily life." summary={[data.state, data.city].filter(Boolean).join(' · ')} open={open.location} complete={sectionComplete('location')} error={sectionError('location')} onToggle={() => setOpen((state) => ({ ...state, location: !state.location }))}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="rounded-xl border border-line bg-ivory p-4"><span className="block text-xs text-muted">Country</span><strong className="mt-1 block text-sm">India</strong></div>
                  <ProfileCombobox id="state" label="State / Union Territory" required value={data.state} options={STATE_OPTIONS} onChange={(state) => update({ state, city: data.city && !(CITY_OPTIONS_BY_STATE[state] ?? []).some((option) => option.value === data.city) ? '' : data.city })} error={errors.state} />
                  <div className="sm:col-span-2"><ProfileCombobox id="city" label="City / District" required value={data.city} options={CITY_OPTIONS_BY_STATE[data.state] ?? []} allowManual onChange={(city) => update({ city: compactProfileText(city) })} error={errors.city} /></div>
                </div>
              </SectionCard>

              <SectionCard id="work" title="Work & Education" icon="▣" helper="Education and professional direction." summary={[data.education, data.profession].filter(Boolean).join(' · ')} open={open.work} complete={sectionComplete('work')} error={sectionError('work')} onToggle={() => setOpen((state) => ({ ...state, work: !state.work }))}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2"><ProfileCombobox id="education" label="Education" required value={data.education} options={EDUCATION_PROFILE_OPTIONS} allowManual onChange={(education) => update({ education })} error={errors.education} /></div>
                  <ProfileCombobox id="employmentType" label="Employment type" required value={data.employmentType} options={employmentProfileOptions} onChange={(employmentType) => update({ employmentType: employmentType as EmploymentType })} error={errors.employmentType} />
                  <ProfileCombobox id="profession" label="Occupation" required value={data.profession} options={OCCUPATION_PROFILE_OPTIONS} allowManual onChange={(profession) => update({ profession })} error={errors.profession} />
                  <div className="sm:col-span-2"><ProfileCombobox label="Annual income" optional value={data.income} options={INCOME_PROFILE_OPTIONS} allowClear onChange={(income) => update({ income })} /></div>
                </div>
              </SectionCard>

              <SectionCard id="family" title="Family" icon="♢" helper="A little context makes introductions warmer." summary={data.familyType ? familyProfileOptions.find((option) => option.value === data.familyType)?.label : ''} open={open.family} complete={sectionComplete('family')} error={sectionError('family')} onToggle={() => setOpen((state) => ({ ...state, family: !state.family }))}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2"><ProfileCombobox id="familyType" label="Family type" required value={data.familyType} options={familyProfileOptions} onChange={(familyType) => update({ familyType: familyType as FamilyType })} error={errors.familyType} /></div>
                  <div className="sm:col-span-2"><FieldLabel htmlFor="familyDescription" optional>Family description</FieldLabel><textarea id="familyDescription" value={data.familyDescription} maxLength={MAX_FAMILY_DESC} rows={4} onChange={(event) => update({ familyDescription: event.target.value })} className="w-full resize-none rounded-xl border border-line-strong bg-cream px-4 py-3 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-maroon/20" /><p className="mt-1 text-right text-xs text-muted">{data.familyDescription.length}/{MAX_FAMILY_DESC}</p></div>
                  <ProfileCombobox label="Father's occupation" optional value={data.fatherOccupation} options={PARENT_OCCUPATION_OPTIONS} allowManual allowClear onChange={(fatherOccupation) => update({ fatherOccupation })} />
                  <ProfileCombobox label="Mother's occupation" optional value={data.motherOccupation} options={PARENT_OCCUPATION_OPTIONS} allowManual allowClear onChange={(motherOccupation) => update({ motherOccupation })} />
                  <ProfileCombobox label="Brothers" optional value={data.brothers} options={siblingProfileOptions} onChange={(brothers) => update({ brothers })} />
                  <ProfileCombobox label="Sisters" optional value={data.sisters} options={siblingProfileOptions} onChange={(sisters) => update({ sisters })} />
                </div>
              </SectionCard>

              <SectionCard id="bio" title="About Yourself" icon="♡" helper="A few honest words go a long way." summary={data.bio ? `${data.bio.length}/${BIO_MAX_CHARS} characters` : ''} open={open.bio} complete={sectionComplete('bio')} error={sectionError('bio')} onToggle={() => setOpen((state) => ({ ...state, bio: !state.bio }))}>
                {!data.bio && <div className="mb-4 flex flex-wrap gap-2">{BIO_STARTERS.map((starter) => <button key={starter.label} type="button" onClick={() => update({ bio: starter.text })} className="min-h-10 rounded-full border border-gold/40 bg-gold/5 px-3 text-xs font-semibold text-maroon">{starter.label}</button>)}</div>}
                <FieldLabel htmlFor="bio" required>Share a little about yourself</FieldLabel>
                <textarea id="bio" value={data.bio} maxLength={BIO_MAX_CHARS} rows={6} onChange={(event) => update({ bio: event.target.value })} aria-invalid={!!errors.bio} aria-describedby={errors.bio ? 'bio-error' : undefined} className={`w-full resize-none rounded-xl border bg-cream px-4 py-3 text-sm leading-6 outline-none focus:border-maroon focus:ring-2 focus:ring-maroon/20 ${errors.bio ? 'border-red-500' : 'border-line-strong'}`} />
                <div className="mt-1 flex justify-between text-xs"><span id={errors.bio ? 'bio-error' : undefined} className="text-red-700">{errors.bio}</span><span className="text-muted">{data.bio.length}/{BIO_MAX_CHARS}</span></div>
              </SectionCard>
            </div>

            {submitError && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{submitError}</p>}
            {submitted && currentValidation.length > 0 && <p className="mt-4 text-center text-xs text-muted">{currentValidation[0].message}</p>}
            <div className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-line bg-ivory/95 px-4 py-4 backdrop-blur sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
              <button type="button" onClick={() => void submit()} disabled={saveState === 'submitting' || photoPending} className="flex min-h-14 w-full items-center justify-center rounded-full bg-maroon px-6 text-sm font-bold text-cream shadow-soft transition hover:bg-maroon-deep focus:ring-2 focus:ring-maroon/30 disabled:opacity-60">
                {saveState === 'submitting' ? 'Creating your profile…' : photoPending ? 'Finish photo upload' : 'Save & Create Profile'}
              </button>
              {!submitted && currentValidation.length > 0 && (
                <p className="mt-2 text-center text-xs text-muted">Complete the required details to create your profile.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
