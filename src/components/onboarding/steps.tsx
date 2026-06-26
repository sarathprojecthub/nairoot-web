'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Field, FieldLabel, FieldError, Hint, Chip, ChipGroup, TextField, TextArea, OptionCard,
} from './fields';
import { ProfilePhoto } from '../ProfilePhoto';
import {
  CREATING_FOR_OPTIONS, MARITAL_OPTIONS, HOROSCOPE_OPTIONS, NAIR_SUBCASTES,
  STATES, KERALA_CITIES, EDUCATION_OPTIONS, EMPLOYMENT_OPTIONS, OCCUPATION_CHIPS,
  INCOME_OPTIONS, FAMILY_TYPE_OPTIONS, FATHER_OCCUPATIONS, MOTHER_OCCUPATIONS,
  SIBLING_COUNTS, FAMILY_DESC_STARTERS, MAX_FAMILY_DESC, BIO_STARTERS, BIO_MIN_CHARS,
  BIO_MAX_CHARS, PROMPT_QUESTIONS, PROMPT_MAX_CHARS, MAX_PHOTOS,
} from '@/lib/onboarding/options';
import { computeAge, isValidCalendarDate, deriveFromCreatingFor } from '@/lib/onboarding/data';
import type { OnboardingData } from '@/lib/onboarding/data';
import {
  assessProfileQuality, generateBioNudge, getFamilyDescriptionPrompt,
} from '@/lib/onboarding/quality';
import { uploadUserPhoto, isCloudinaryConfigured } from '@/lib/cloudinary';
import { MIN_AGE, MAX_AGE } from '@/lib/onboarding/options';

type Update = (patch: Partial<OnboardingData>) => void;

interface StepProps {
  data: OnboardingData;
  update: Update;
}

// ─── Step 0 — Account (phone) ─────────────────────────────────────────────────
export function AccountStep({ phone, setPhone }: { phone: string; setPhone: (v: string) => void }) {
  return (
    <div>
      <Field>
        <FieldLabel required>Mobile number</FieldLabel>
        <TextField
          value={phone}
          onChange={(v) => setPhone(v.replace(/[^\d+]/g, '').slice(0, 15))}
          placeholder="e.g. +91 98765 43210"
          inputMode="tel"
          autoFocus
        />
        <Hint>
          We use your number to secure your account. It is never shown on your public profile.
        </Hint>
      </Field>
      <p className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-xs leading-relaxed text-stone-500">
        By continuing you create your Nair Root account. Your profile is reviewed before
        introductions begin, and introductions are always private and mutual.
      </p>
    </div>
  );
}

// ─── Step 1 — Create Profile (name + who for) ─────────────────────────────────
export function CreateProfileStep({ data, update }: StepProps) {
  return (
    <div>
      <Field>
        <FieldLabel>This profile is for</FieldLabel>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CREATING_FOR_OPTIONS.map((opt) => (
            <OptionCard
              key={opt.value}
              label={opt.label}
              sub={opt.sub}
              selected={data.creatingFor === opt.value}
              onClick={() => update({ creatingFor: opt.value, ...deriveFromCreatingFor(opt.gender) })}
            />
          ))}
        </div>
      </Field>
      <Field>
        <FieldLabel required>Full name</FieldLabel>
        <TextField
          value={data.name}
          onChange={(v) => update({ name: v })}
          placeholder="e.g. Priya Nair"
        />
      </Field>
    </div>
  );
}

// ─── Step 2 — Personal Details ────────────────────────────────────────────────
export function PersonalStep({ data, update }: StepProps) {
  const [day, setDay] = useState(() => data.dob.split('-')[2] ?? '');
  const [month, setMonth] = useState(() => data.dob.split('-')[1] ?? '');
  const [year, setYear] = useState(() => data.dob.split('-')[0] ?? '');
  const [age, setAge] = useState<number | null>(data.age > 0 ? data.age : null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    if (day.length >= 1 && month.length >= 1 && year.length === 4) {
      const d = parseInt(day, 10), m = parseInt(month, 10), y = parseInt(year, 10);
      if (!isValidCalendarDate(d, m, y)) {
        setError('Enter a valid date'); setAge(null); update({ dob: '', age: 0 }); return;
      }
      const a = computeAge(y, m, d);
      if (a < MIN_AGE) { setError(`Must be at least ${MIN_AGE} years old`); setAge(null); update({ dob: '', age: 0 }); return; }
      if (a > MAX_AGE) { setError('Enter a valid birth year'); setAge(null); update({ dob: '', age: 0 }); return; }
      setAge(a);
      update({ dob: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, age: a });
    } else {
      setAge(null);
      if (data.dob) update({ dob: '', age: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, month, year]);

  return (
    <div>
      <Field>
        <FieldLabel required>Date of birth</FieldLabel>
        <div className="flex items-center gap-2">
          <input
            value={day} inputMode="numeric" placeholder="DD" maxLength={2}
            onChange={(e) => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
            className="w-16 rounded-lg border border-stone-200 bg-white px-3 py-3 text-center text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
          />
          <span className="text-stone-300">/</span>
          <input
            value={month} inputMode="numeric" placeholder="MM" maxLength={2}
            onChange={(e) => setMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
            className="w-16 rounded-lg border border-stone-200 bg-white px-3 py-3 text-center text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
          />
          <span className="text-stone-300">/</span>
          <input
            value={year} inputMode="numeric" placeholder="YYYY" maxLength={4}
            onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="w-24 rounded-lg border border-stone-200 bg-white px-3 py-3 text-center text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
          />
          {age !== null && (
            <span className="ml-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              {age} yrs
            </span>
          )}
        </div>
        {error && <FieldError>{error}</FieldError>}
      </Field>

      <Field>
        <FieldLabel>Height</FieldLabel>
        <TextField value={data.height} onChange={(v) => update({ height: v })} placeholder={`e.g. 5'6"`} />
      </Field>

      <Field>
        <FieldLabel required>Marital status</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {MARITAL_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              selected={data.maritalStatus === opt.value}
              onClick={() => update({ maritalStatus: opt.value })}
            />
          ))}
        </div>
      </Field>

      <Field>
        <FieldLabel>Mother tongue</FieldLabel>
        <TextField value={data.motherTongue} onChange={(v) => update({ motherTongue: v })} placeholder="e.g. Malayalam" />
      </Field>
    </div>
  );
}

// ─── Step 3 — Religious Details ───────────────────────────────────────────────
export function ReligiousStep({ data, update }: StepProps) {
  return (
    <div>
      <div className="mb-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <span className="text-sm text-stone-400">Religion</span>
          <span className="text-sm font-medium text-stone-800">Hindu</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-stone-400">Caste</span>
          <span className="text-sm font-medium text-stone-800">Nair</span>
        </div>
      </div>

      <Field>
        <FieldLabel optional>Subcaste</FieldLabel>
        <ChipGroup options={NAIR_SUBCASTES} value={data.subcaste} onChange={(v) => update({ subcaste: v })} toggleable />
        <div className="mt-2">
          <TextField value={data.subcaste} onChange={(v) => update({ subcaste: v })} placeholder="Or type your subcaste" />
        </div>
      </Field>

      <Field>
        <FieldLabel optional>Birth star (Nakshatra)</FieldLabel>
        <TextField value={data.star} onChange={(v) => update({ star: v })} placeholder="e.g. Karthika, Rohini" />
      </Field>

      <Field>
        <FieldLabel required>Do horoscope details matter to you?</FieldLabel>
        <div className="flex flex-col gap-2">
          {HOROSCOPE_OPTIONS.map((opt) => (
            <OptionCard
              key={opt.value}
              label={opt.label}
              sub={opt.sub}
              selected={data.horoscopePreference === opt.value}
              onClick={() => update({ horoscopePreference: opt.value })}
            />
          ))}
        </div>
      </Field>
    </div>
  );
}

// ─── Step 4 — Location ────────────────────────────────────────────────────────
export function LocationStep({ data, update }: StepProps) {
  const suggested = data.state === 'Kerala' ? KERALA_CITIES : [];
  return (
    <div>
      <div className="mb-7 overflow-hidden rounded-xl border border-stone-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-stone-400">Country</span>
          <span className="text-sm font-medium text-stone-800">India</span>
        </div>
      </div>

      <Field>
        <FieldLabel required>State</FieldLabel>
        <ChipGroup options={STATES} value={data.state} onChange={(v) => update({ state: v })} />
      </Field>

      <Field>
        <FieldLabel required>City / District</FieldLabel>
        <TextField value={data.city} onChange={(v) => update({ city: v })} placeholder="e.g. Kochi" />
        {suggested.length > 0 && (
          <div className="mt-2">
            <ChipGroup options={suggested} value={data.city} onChange={(v) => update({ city: v })} />
          </div>
        )}
      </Field>
    </div>
  );
}

// ─── Step 5 — Professional Details ────────────────────────────────────────────
export function ProfessionalStep({ data, update }: StepProps) {
  return (
    <div>
      <Field>
        <FieldLabel required>Highest education</FieldLabel>
        <ChipGroup options={EDUCATION_OPTIONS} value={data.education} onChange={(v) => update({ education: v })} />
      </Field>

      <Field>
        <FieldLabel required>Employed in</FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          {EMPLOYMENT_OPTIONS.map((opt) => (
            <OptionCard
              key={opt.value}
              label={opt.label}
              selected={data.employmentType === opt.value}
              onClick={() => update({ employmentType: opt.value })}
              className="text-center"
            />
          ))}
        </div>
      </Field>

      <Field>
        <FieldLabel required>Occupation</FieldLabel>
        <TextField value={data.profession} onChange={(v) => update({ profession: v })} placeholder="e.g. Software Engineer" />
        <div className="mt-2">
          <ChipGroup options={OCCUPATION_CHIPS} value={data.profession} onChange={(v) => update({ profession: v })} />
        </div>
      </Field>

      <Field>
        <FieldLabel optional>Annual income</FieldLabel>
        <ChipGroup options={INCOME_OPTIONS} value={data.income} onChange={(v) => update({ income: v })} toggleable />
      </Field>
    </div>
  );
}

// ─── Step 6 — Family Details ──────────────────────────────────────────────────
export function FamilyStep({ data, update }: StepProps) {
  const remaining = MAX_FAMILY_DESC - data.familyDescription.length;
  const prompt = getFamilyDescriptionPrompt(data.familyDescription);
  return (
    <div>
      <Field>
        <FieldLabel required>Family structure</FieldLabel>
        <div className="flex flex-col gap-2">
          {FAMILY_TYPE_OPTIONS.map((opt) => (
            <OptionCard
              key={opt.value}
              label={opt.label}
              sub={opt.sub}
              selected={data.familyType === opt.value}
              onClick={() => update({ familyType: opt.value })}
            />
          ))}
        </div>
      </Field>

      <Field>
        <FieldLabel optional>Describe your family</FieldLabel>
        <Hint>A few honest lines help other families feel grounded before an introduction.</Hint>
        {data.familyDescription.length === 0 && (
          <div className="mb-3 mt-3 flex flex-col gap-2">
            {FAMILY_DESC_STARTERS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => update({ familyDescription: s.text })}
                className="rounded-lg border border-stone-200 bg-white px-3.5 py-2.5 text-left transition hover:border-stone-300"
              >
                <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">{s.label}</div>
                <div className="mt-0.5 line-clamp-2 text-xs text-stone-500">{s.text}</div>
              </button>
            ))}
          </div>
        )}
        <div className="mt-2">
          <TextArea
            value={data.familyDescription}
            onChange={(v) => update({ familyDescription: v })}
            maxLength={MAX_FAMILY_DESC}
            placeholder="e.g. Close-knit family from Thrissur. Father is a retired civil servant…"
            rows={4}
          />
        </div>
        {prompt && remaining < MAX_FAMILY_DESC && <p className="mt-1 text-xs italic text-amber-600">{prompt}</p>}
      </Field>

      <Field>
        <FieldLabel optional>Father&apos;s occupation</FieldLabel>
        <ChipGroup options={FATHER_OCCUPATIONS} value={data.fatherOccupation} onChange={(v) => update({ fatherOccupation: v })} toggleable />
      </Field>

      <Field>
        <FieldLabel optional>Mother&apos;s occupation</FieldLabel>
        <ChipGroup options={MOTHER_OCCUPATIONS} value={data.motherOccupation} onChange={(v) => update({ motherOccupation: v })} toggleable />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel>Brothers</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {SIBLING_COUNTS.map((n) => (
              <Chip key={n} label={n} selected={data.brothers === n} onClick={() => update({ brothers: n })} />
            ))}
          </div>
        </Field>
        <Field>
          <FieldLabel>Sisters</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {SIBLING_COUNTS.map((n) => (
              <Chip key={n} label={n} selected={data.sisters === n} onClick={() => update({ sisters: n })} />
            ))}
          </div>
        </Field>
      </div>
    </div>
  );
}

// ─── Step 7 — Bio ─────────────────────────────────────────────────────────────
export function BioStep({ data, update }: StepProps) {
  const ready = data.bio.trim().length >= BIO_MIN_CHARS;
  const nudge = generateBioNudge(data.bio);
  const [showPrompt, setShowPrompt] = useState(!!data.promptQuestion);

  return (
    <div>
      <p className="mb-3 text-sm italic text-stone-500">
        What matters to you? What does a good life feel like to you?
      </p>
      <TextArea
        value={data.bio}
        onChange={(v) => update({ bio: v })}
        maxLength={BIO_MAX_CHARS}
        rows={6}
        placeholder="Write a few lines about who you are, your values, and what you are looking for in a life partner…"
      />
      {!ready && data.bio.length > 0 && (
        <p className="mt-1 text-xs text-stone-400">
          A little more — at least {BIO_MIN_CHARS} characters gives people a sense of who you are.
        </p>
      )}
      {ready && nudge && <p className="mt-1 text-xs italic text-amber-600">{nudge}</p>}

      {data.bio.length === 0 && (
        <div className="mt-4 flex flex-col gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Some starting points</div>
          {BIO_STARTERS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => update({ bio: s.text })}
              className="rounded-lg border border-stone-200 bg-white px-3.5 py-2.5 text-left transition hover:border-stone-300"
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">{s.label}</div>
              <div className="mt-0.5 line-clamp-2 text-xs text-stone-500">{s.text}</div>
            </button>
          ))}
        </div>
      )}

      {ready && (
        <div className="mt-7 border-t border-stone-100 pt-6">
          {!data.promptQuestion && !showPrompt && (
            <button
              type="button"
              onClick={() => setShowPrompt(true)}
              className="w-full rounded-lg border border-stone-200 bg-white py-3 text-sm font-medium text-amber-700 transition hover:border-stone-300"
            >
              + Add a personal note (optional)
            </button>
          )}
          {!data.promptQuestion && showPrompt && (
            <div>
              <FieldLabel optional>Add a personal note</FieldLabel>
              <Hint>One question, answered in your own words.</Hint>
              <div className="mt-3 flex flex-col gap-2">
                {PROMPT_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => update({ promptQuestion: q, promptAnswer: '' })}
                    className="rounded-lg border border-amber-200 bg-amber-50/50 px-3.5 py-3 text-left text-sm italic text-stone-600 transition hover:bg-amber-50"
                  >
                    &ldquo;{q}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          )}
          {data.promptQuestion && (
            <div>
              <div className="mb-2 flex items-start justify-between gap-2">
                <span className="text-sm font-medium italic text-amber-700">&ldquo;{data.promptQuestion}&rdquo;</span>
                <button
                  type="button"
                  onClick={() => update({ promptQuestion: '', promptAnswer: '' })}
                  className="shrink-0 text-xs text-stone-400 hover:text-stone-600"
                >
                  Remove
                </button>
              </div>
              <TextArea
                value={data.promptAnswer}
                onChange={(v) => update({ promptAnswer: v })}
                maxLength={PROMPT_MAX_CHARS}
                rows={3}
                placeholder="Write your answer…"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Step 8 — Photos ──────────────────────────────────────────────────────────
type SlotState = { previewUrl: string; status: 'uploading' | 'done' | 'error'; url?: string };

export function PhotosStep({
  data, update, uid,
}: StepProps & { uid: string }) {
  const [slots, setSlots] = useState<(SlotState | null)[]>(() =>
    Array.from({ length: MAX_PHOTOS }, (_, i) =>
      data.photos[i] ? { previewUrl: data.photos[i], status: 'done', url: data.photos[i] } : null,
    ),
  );
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const configured = isCloudinaryConfigured();

  function syncPhotos(next: (SlotState | null)[]) {
    update({ photos: next.filter((s): s is SlotState => !!s?.url).map((s) => s.url!) });
  }

  async function pick(index: number, file: File) {
    const previewUrl = URL.createObjectURL(file);
    setSlots((prev) => {
      const next = [...prev];
      next[index] = { previewUrl, status: 'uploading' };
      return next;
    });
    try {
      const url = await uploadUserPhoto(file, uid, index);
      setSlots((prev) => {
        const next = [...prev];
        next[index] = { previewUrl, status: 'done', url };
        syncPhotos(next);
        return next;
      });
    } catch {
      setSlots((prev) => {
        const next = [...prev];
        next[index] = { previewUrl, status: 'error' };
        return next;
      });
    }
  }

  function remove(index: number) {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = null;
      syncPhotos(next);
      return next;
    });
  }

  return (
    <div>
      {!configured && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
          Photo upload is not configured yet. Set <code>NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code> and{' '}
          <code>NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET</code> in <code>.env.local</code> to enable uploads.
        </p>
      )}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
          const slot = slots[i];
          return (
            <div key={i} className="relative">
              <input
                ref={(el) => { inputRefs.current[i] = el; }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void pick(i, file);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => inputRefs.current[i]?.click()}
                className={`relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-xl border transition ${
                  i === 0 ? 'border-amber-300' : 'border-stone-200'
                } ${slot ? '' : 'bg-white hover:border-stone-300'}`}
              >
                {slot ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={slot.previewUrl} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-1 text-stone-400">
                    <span className="text-2xl">＋</span>
                    <span className="text-[11px]">{i === 0 ? 'Primary' : 'Add'}</span>
                  </span>
                )}
                {slot?.status === 'uploading' && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  </span>
                )}
                {slot?.status === 'error' && (
                  <span className="absolute inset-0 flex items-center justify-center bg-red-600/70 text-xs font-medium text-white">
                    Failed — tap to retry
                  </span>
                )}
              </button>
              {slot && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-xs text-white"
                  aria-label="Remove photo"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-center text-xs text-stone-400">
        Natural light, face clearly visible. At least one photo is needed to continue.
      </p>
    </div>
  );
}

// ─── Step 9 — Preview ─────────────────────────────────────────────────────────
export function PreviewStep({ data }: { data: OnboardingData }) {
  const genderLabel = data.gender === 'male' ? 'Man' : data.gender === 'female' ? 'Woman' : '';
  const quality = (() => {
    try {
      return assessProfileQuality({
        bio: data.bio, photos: data.photos,
        promptAnswer: data.promptAnswer, familyDescription: data.familyDescription,
      }).note;
    } catch {
      return '';
    }
  })();
  const lookingFor = data.lookingFor.gender === 'any'
    ? 'Open to meeting anyone'
    : `A ${data.lookingFor.gender === 'male' ? 'man' : 'woman'}${
        data.lookingFor.ageRange !== 'any' ? ` in the ${data.lookingFor.ageRange} age range` : ''
      }`;

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="relative aspect-[4/5] w-full bg-stone-100">
          <ProfilePhoto src={data.photos[0] ?? ''} name={data.name} seed={data.name || 'me'} className="h-full w-full" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
            <div className="font-serif text-xl font-semibold text-white">{data.name || 'Your Name'}</div>
            <div className="text-sm text-white/90">
              {data.age > 0 ? `${data.age} years` : ''}
              {data.age > 0 && data.city ? '  ·  ' : ''}
              {data.city}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap gap-2">
            {data.profession && <Badge>{data.profession}</Badge>}
            <Badge>{data.religion}</Badge>
            {genderLabel && <Badge>{genderLabel}</Badge>}
          </div>
          {data.bio && (
            <div>
              <SectionTitle>About</SectionTitle>
              <p className="text-sm leading-relaxed text-stone-600">{data.bio}</p>
            </div>
          )}
          <div>
            <SectionTitle>Looking for</SectionTitle>
            <p className="text-sm text-stone-600">{lookingFor}</p>
          </div>
        </div>
      </div>

      {quality && (
        <p className="mt-4 rounded-lg border border-stone-200 bg-white px-4 py-3 text-center text-sm italic text-stone-500">
          {quality}
        </p>
      )}
      <p className="mt-4 text-center text-xs leading-relaxed text-stone-400">
        Your profile is reviewed before introductions begin. Introductions are private, mutual, and
        considered carefully.
      </p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600">
      {children}
    </span>
  );
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">{children}</div>;
}
