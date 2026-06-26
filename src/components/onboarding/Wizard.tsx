'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingShell } from './OnboardingShell';
import { PrimaryButton } from './fields';
import {
  AccountStep, CreateProfileStep, PersonalStep, ReligiousStep, LocationStep,
  ProfessionalStep, FamilyStep, BioStep, PhotosStep, PreviewStep,
} from './steps';
import { INITIAL_ONBOARDING_DATA } from '@/lib/onboarding/data';
import type { OnboardingData } from '@/lib/onboarding/data';
import { ensureAuth } from '@/lib/profiles';
import { signInWithPhone } from '@/lib/auth';
import { fetchUser } from '@/lib/user';
import { saveOnboardingDraft, loadOnboardingDraft } from '@/lib/onboarding/draft';
import type { OnboardingDraft } from '@/lib/onboarding/draft';
import { completeProfile } from '@/lib/onboarding/complete';
import { BIO_MIN_CHARS } from '@/lib/onboarding/options';
import type {
  CreatingFor, Gender, Religion, MaritalStatus, EmploymentType,
  FamilyType, HoroscopePreference, AgeRangePreference,
} from '@/lib/onboarding/options';

interface StepMeta {
  title: string;
  subtitle?: string;
  androidStep: number | null; // draft.completedStep value; null = no draft (account)
  cta: string;
  valid: (d: OnboardingData, phone: string) => boolean;
}

const STEPS: StepMeta[] = [
  { title: 'Create your account', subtitle: 'Your number secures your account and is never shown publicly.', androidStep: null, cta: 'Continue', valid: (_d, phone) => phone.replace(/\D/g, '').length >= 8 },
  { title: 'Your profile', subtitle: 'Is this for yourself, or for a family member?', androidStep: 1, cta: 'Continue', valid: (d) => d.creatingFor !== '' && d.name.trim().length >= 2 },
  { title: 'A few basics', subtitle: 'Age, height, and a few details that help families picture who you are.', androidStep: 2, cta: 'Continue', valid: (d) => d.dob !== '' && d.age > 0 && d.maritalStatus !== '' },
  { title: 'Background', subtitle: 'Spiritual and cultural roots — how much they matter is yours to say.', androidStep: 3, cta: 'Continue', valid: (d) => d.horoscopePreference !== '' },
  { title: 'Location', subtitle: 'Where you live helps families understand your daily world.', androidStep: 4, cta: 'Continue', valid: (d) => d.state !== '' && d.city.trim().length >= 2 },
  { title: 'Your work', subtitle: 'Education and career offer a quiet sense of direction.', androidStep: 5, cta: 'Continue', valid: (d) => d.education !== '' && d.employmentType !== '' && d.profession.trim().length >= 2 },
  { title: 'Your family', subtitle: 'Families read this to understand who you come from.', androidStep: 6, cta: 'Continue', valid: (d) => d.familyType !== '' },
  { title: 'About yourself', subtitle: 'A few honest words go further than a polished description.', androidStep: 7, cta: 'Save & Continue', valid: (d) => d.bio.trim().length >= BIO_MIN_CHARS },
  { title: 'Your photos', subtitle: 'Natural photos. Real light. The kind that show who you actually are.', androidStep: 8, cta: 'Preview Profile', valid: (d) => d.photos.length >= 1 },
  { title: 'Your profile', subtitle: 'This is how families will see you. Take a moment to read it through.', androidStep: 8, cta: 'Complete Profile', valid: () => true },
];

function hydrateFromDraft(draft: OnboardingDraft): OnboardingData {
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
    photos: draft.photos ?? base.photos,
    gender: (draft.gender as Gender | '') ?? base.gender,
    religion: (draft.religion as Religion) ?? base.religion,
    lookingFor: {
      gender: (draft.lookingForGender as Gender | 'any') ?? base.lookingFor.gender,
      ageRange: (draft.lookingForAgeRange as AgeRangePreference) ?? base.lookingFor.ageRange,
    },
  };
}

export function OnboardingWizard() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [data, setData] = useState<OnboardingData>(INITIAL_ONBOARDING_DATA);
  const [phone, setPhone] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Boot: establish session, resume any draft, skip the account step if already done.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await ensureAuth();
        if (cancelled) return;
        setUid(user.uid);

        const [existing, draft] = await Promise.all([
          fetchUser(user.uid).catch(() => null),
          loadOnboardingDraft(user.uid).catch(() => null),
        ]);
        if (cancelled) return;

        if (existing?.isOnboarded) {
          router.replace('/discover');
          return;
        }
        if (existing?.phone) setPhone(existing.phone);

        if (draft && draft.completedStep > 0) {
          setData(hydrateFromDraft(draft));
          setStepIndex(Math.min(draft.completedStep + 1, STEPS.length - 1));
        } else if (existing?.phone) {
          setStepIndex(1); // account already created — start at profile basics
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  const meta = STEPS[stepIndex];
  const canContinue = useMemo(() => meta.valid(data, phone), [meta, data, phone]);

  function update(patch: Partial<OnboardingData>) {
    setData((prev) => ({ ...prev, ...patch }));
  }

  async function handleContinue() {
    if (!canContinue || busy || !uid) return;
    setError(null);

    // Account step → write the users/{uid} doc with the phone number.
    if (stepIndex === 0) {
      setBusy(true);
      try {
        await signInWithPhone(phone);
      } catch {
        setBusy(false);
        setError('Could not create your account. Please try again.');
        return;
      }
      setBusy(false);
      setStepIndex(1);
      return;
    }

    // Final step → write the real Firestore documents Android also creates.
    if (stepIndex === STEPS.length - 1) {
      setBusy(true);
      try {
        await completeProfile(uid, data);
        router.replace('/discover');
      } catch (e) {
        setBusy(false);
        setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      }
      return;
    }

    // Persist a draft for the step just completed, then advance.
    if (meta.androidStep) {
      void saveOnboardingDraft(uid, data, meta.androidStep).catch(() => {});
    }
    setStepIndex((i) => i + 1);
  }

  function handleBack() {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  if (booting || !uid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-stone-700" />
      </div>
    );
  }

  return (
    <OnboardingShell
      step={stepIndex + 1}
      totalSteps={STEPS.length}
      title={meta.title}
      subtitle={meta.subtitle}
      onBack={stepIndex > 0 ? handleBack : undefined}
      footer={
        <>
          <PrimaryButton onClick={handleContinue} disabled={!canContinue} loading={busy}>
            {meta.cta}
          </PrimaryButton>
          {error && <p className="mt-2 text-center text-sm text-red-600">{error}</p>}
          {stepIndex === STEPS.length - 1 && !error && (
            <p className="mt-2 text-center text-xs text-stone-400">
              Your profile will appear in Discover right away.
            </p>
          )}
        </>
      }
    >
      {stepIndex === 0 && <AccountStep phone={phone} setPhone={setPhone} />}
      {stepIndex === 1 && <CreateProfileStep data={data} update={update} />}
      {stepIndex === 2 && <PersonalStep data={data} update={update} />}
      {stepIndex === 3 && <ReligiousStep data={data} update={update} />}
      {stepIndex === 4 && <LocationStep data={data} update={update} />}
      {stepIndex === 5 && <ProfessionalStep data={data} update={update} />}
      {stepIndex === 6 && <FamilyStep data={data} update={update} />}
      {stepIndex === 7 && <BioStep data={data} update={update} />}
      {stepIndex === 8 && <PhotosStep data={data} update={update} uid={uid} />}
      {stepIndex === 9 && <PreviewStep data={data} />}
    </OnboardingShell>
  );
}
