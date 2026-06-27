'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingShell } from './OnboardingShell';
import { PrimaryButton } from './fields';
import {
  ProfileBasicsStep, AboutYouStep, WhereWorkStep, FamilyStoryStep, PhotosStep, ReviewStep,
} from './steps';
import { INITIAL_ONBOARDING_DATA } from '@/lib/onboarding/data';
import type { OnboardingData } from '@/lib/onboarding/data';
import { ensureAuth } from '@/lib/profiles';
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
  cta: string;
  valid: (d: OnboardingData) => boolean;
}

// Web-native grouping (identity/phone are verified at login, not here):
// Profile basics + 4 content steps + review.
const STEPS: StepMeta[] = [
  {
    title: 'Welcome — let’s set up your profile',
    subtitle: 'A few grouped steps. Your progress saves automatically.',
    cta: 'Continue',
    valid: (d) => d.creatingFor !== '' && d.name.trim().length >= 2,
  },
  {
    title: 'About you',
    subtitle: 'Age, a few basics, and your cultural background — how much it matters is yours to say.',
    cta: 'Continue',
    valid: (d) => d.dob !== '' && d.age > 0 && d.maritalStatus !== '' && d.horoscopePreference !== '',
  },
  {
    title: 'Where you are & what you do',
    subtitle: 'Location and work give families a quiet sense of your daily world.',
    cta: 'Continue',
    valid: (d) => d.state !== '' && d.city.trim().length >= 2 && d.education !== '' && d.employmentType !== '' && d.profession.trim().length >= 2,
  },
  {
    title: 'Family & your story',
    subtitle: 'Who you come from, and a few honest words about who you are.',
    cta: 'Continue',
    valid: (d) => d.familyType !== '' && d.bio.trim().length >= BIO_MIN_CHARS,
  },
  {
    title: 'Your photos',
    subtitle: 'Natural photos. Real light. The kind that show who you actually are.',
    cta: 'Review profile',
    valid: (d) => d.photos.length >= 1,
  },
  {
    title: 'Review & complete',
    subtitle: 'This is how families will see you. Take a moment to read it through.',
    cta: 'Complete Profile',
    valid: () => true,
  },
];
const REVIEW = STEPS.length - 1;

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

// Resume at the first step whose data isn't complete (robust to step regrouping).
function firstIncomplete(data: OnboardingData): number {
  for (let i = 0; i < REVIEW; i++) if (!STEPS[i].valid(data)) return i;
  return REVIEW;
}

export function OnboardingWizard() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [data, setData] = useState<OnboardingData>(INITIAL_ONBOARDING_DATA);
  const [stepIndex, setStepIndex] = useState(0);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Identity is established at login; here we just load the signed-in user and
  // resume any saved draft. Already-onboarded members are sent to Discover.
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
        if (existing?.isOnboarded) { router.replace('/discover'); return; }
        if (draft) {
          const hydrated = hydrateFromDraft(draft);
          setData(hydrated);
          setStepIndex(firstIncomplete(hydrated));
        }
      } catch {
        // not authenticated — the page guard redirects to /login
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  const meta = STEPS[stepIndex];
  const canContinue = useMemo(() => meta.valid(data), [meta, data]);

  function update(patch: Partial<OnboardingData>) {
    setData((prev) => ({ ...prev, ...patch }));
  }

  async function handleContinue() {
    if (!canContinue || busy || !uid) return;
    setError(null);

    if (stepIndex === REVIEW) {
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

    void saveOnboardingDraft(uid, data, stepIndex).catch(() => {});
    setStepIndex((i) => i + 1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA' && canContinue && !busy) {
      e.preventDefault();
      void handleContinue();
    }
  }

  if (booting || !uid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-stone-700" />
      </div>
    );
  }

  return (
    <div onKeyDown={handleKeyDown}>
      <OnboardingShell
        step={stepIndex + 1}
        totalSteps={STEPS.length}
        title={meta.title}
        subtitle={meta.subtitle}
        onBack={stepIndex > 0 ? () => { setError(null); setStepIndex((i) => Math.max(i - 1, 0)); } : undefined}
        footer={
          <>
            <div className="sm:ml-auto sm:w-64">
              <PrimaryButton onClick={handleContinue} disabled={!canContinue} loading={busy}>{meta.cta}</PrimaryButton>
            </div>
            <div aria-live="polite" className="mt-2 text-center sm:text-right">
              {error && <p className="text-sm text-red-600">{error}</p>}
              {!error && !canContinue && stepIndex !== REVIEW && (
                <p className="text-xs text-stone-400">A few required fields are still empty.</p>
              )}
              {!error && stepIndex === REVIEW && (
                <p className="text-xs text-stone-400">Your profile will appear in Discover right away.</p>
              )}
            </div>
          </>
        }
      >
        {stepIndex === 0 && <ProfileBasicsStep data={data} update={update} />}
        {stepIndex === 1 && <AboutYouStep data={data} update={update} />}
        {stepIndex === 2 && <WhereWorkStep data={data} update={update} />}
        {stepIndex === 3 && <FamilyStoryStep data={data} update={update} />}
        {stepIndex === 4 && <PhotosStep data={data} update={update} uid={uid} />}
        {stepIndex === 5 && <ReviewStep data={data} />}
      </OnboardingShell>
    </div>
  );
}
