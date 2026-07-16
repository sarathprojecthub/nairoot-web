'use client';

import { useEffect, useRef, useState } from 'react';
import {
  FieldLabel, FieldError, Chip, ChipGroup, TextField, TextArea, OptionCard,
} from './fields';
import { ProfilePhoto } from '../ProfilePhoto';
import {
  CREATING_FOR_OPTIONS, MARITAL_OPTIONS, HOROSCOPE_OPTIONS, NAIR_SUBCASTES,
  STATES, KERALA_CITIES, EDUCATION_OPTIONS, EMPLOYMENT_OPTIONS, OCCUPATION_CHIPS,
  INCOME_OPTIONS, FAMILY_TYPE_OPTIONS, FATHER_OCCUPATIONS, MOTHER_OCCUPATIONS,
  SIBLING_COUNTS, FAMILY_DESC_STARTERS, MAX_FAMILY_DESC, BIO_STARTERS, BIO_MIN_CHARS,
  BIO_MAX_CHARS, PROMPT_QUESTIONS, PROMPT_MAX_CHARS, MAX_PHOTOS, MIN_AGE, MAX_AGE,
} from '@/lib/onboarding/options';
import { computeAge, isValidCalendarDate, deriveFromCreatingFor } from '@/lib/onboarding/data';
import type { OnboardingData } from '@/lib/onboarding/data';
import {
  assessProfileQuality, generateBioNudge, getFamilyDescriptionPrompt,
} from '@/lib/onboarding/quality';
import { uploadUserPhoto, isCloudinaryConfigured } from '@/lib/cloudinary';

type Update = (patch: Partial<OnboardingData>) => void;
interface StepProps { data: OnboardingData; update: Update; }

// ── layout helpers — responsive 2-col grid that stacks on mobile ──────────────
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">{children}</div>;
}
function Cell({ span, children }: { span?: boolean; children: React.ReactNode }) {
  return <div className={span ? 'sm:col-span-2' : ''}>{children}</div>;
}
function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      {title && <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>}
      {children}
    </section>
  );
}

// ─── Step 1 — Profile basics (email-auth account exists; phone is not verified yet) ───────
export function ProfileBasicsStep({ data, update }: StepProps) {
  return (
    <div>
      <Group title="Who this profile is for">
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
        <div className="mt-6">
          <FieldLabel required>Full name</FieldLabel>
          <TextField value={data.name} onChange={(v) => update({ name: v })} placeholder="e.g. Priya Nair" autoFocus />
        </div>
      </Group>
    </div>
  );
}

// ─── Step 2 — About you (basics + background) ─────────────────────────────────
function DobField({ data, update }: StepProps) {
  const [day, setDay] = useState(() => data.dob.split('-')[2] ?? '');
  const [month, setMonth] = useState(() => data.dob.split('-')[1] ?? '');
  const [year, setYear] = useState(() => data.dob.split('-')[0] ?? '');
  const [age, setAge] = useState<number | null>(data.age > 0 ? data.age : null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    if (day.length >= 1 && month.length >= 1 && year.length === 4) {
      const d = parseInt(day, 10), m = parseInt(month, 10), y = parseInt(year, 10);
      if (!isValidCalendarDate(d, m, y)) { setError('Enter a valid date'); setAge(null); update({ dob: '', age: 0 }); return; }
      const a = computeAge(y, m, d);
      if (a < MIN_AGE) { setError(`Must be at least ${MIN_AGE}`); setAge(null); update({ dob: '', age: 0 }); return; }
      if (a > MAX_AGE) { setError('Enter a valid birth year'); setAge(null); update({ dob: '', age: 0 }); return; }
      setAge(a);
      update({ dob: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, age: a });
    } else {
      setAge(null);
      if (data.dob) update({ dob: '', age: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, month, year]);

  const box = 'rounded-lg border border-line-strong bg-cream px-3 py-3 text-center text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20';
  return (
    <div>
      <FieldLabel required>Date of birth</FieldLabel>
      <div className="flex flex-wrap items-center gap-2">
        <input value={day} inputMode="numeric" placeholder="DD" maxLength={2} aria-label="Day"
          onChange={(e) => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))} className={`w-14 ${box}`} />
        <span className="text-stone-300">/</span>
        <input value={month} inputMode="numeric" placeholder="MM" maxLength={2} aria-label="Month"
          onChange={(e) => setMonth(e.target.value.replace(/\D/g, '').slice(0, 2))} className={`w-14 ${box}`} />
        <span className="text-stone-300">/</span>
        <input value={year} inputMode="numeric" placeholder="YYYY" maxLength={4} aria-label="Year"
          onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} className={`w-20 ${box}`} />
        {age !== null && <span className="ml-1 rounded-full bg-gold/10 px-3 py-1 text-xs font-semibold text-maroon">{age} yrs</span>}
      </div>
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}

export function AboutYouStep({ data, update }: StepProps) {
  return (
    <div>
      <Group title="Basics">
        <Grid>
          <Cell><DobField data={data} update={update} /></Cell>
          <Cell>
            <FieldLabel>Height</FieldLabel>
            <TextField value={data.height} onChange={(v) => update({ height: v })} placeholder={`e.g. 5'6"`} />
          </Cell>
          <Cell span>
            <FieldLabel required>Marital status</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {MARITAL_OPTIONS.map((opt) => (
                <Chip key={opt.value} label={opt.label} selected={data.maritalStatus === opt.value} onClick={() => update({ maritalStatus: opt.value })} />
              ))}
            </div>
          </Cell>
          <Cell>
            <FieldLabel>Mother tongue</FieldLabel>
            <TextField value={data.motherTongue} onChange={(v) => update({ motherTongue: v })} placeholder="e.g. Malayalam" />
          </Cell>
        </Grid>
      </Group>

      <Group title="Background">
        <div className="mb-4 flex gap-6 rounded-xl border border-line bg-cream px-4 py-3 text-sm">
          <span><span className="text-muted">Religion</span> <span className="font-medium text-charcoal">Hindu</span></span>
          <span><span className="text-muted">Caste</span> <span className="font-medium text-charcoal">Nair</span></span>
        </div>
        <Grid>
          <Cell span>
            <FieldLabel optional>Subcaste</FieldLabel>
            <ChipGroup options={NAIR_SUBCASTES} value={data.subcaste} onChange={(v) => update({ subcaste: v })} toggleable />
            <div className="mt-2"><TextField value={data.subcaste} onChange={(v) => update({ subcaste: v })} placeholder="Or type your subcaste" /></div>
          </Cell>
          <Cell>
            <FieldLabel optional>Birth star (Nakshatra)</FieldLabel>
            <TextField value={data.star} onChange={(v) => update({ star: v })} placeholder="e.g. Karthika, Rohini" />
          </Cell>
          <Cell span>
            <FieldLabel required>Do horoscope details matter to you?</FieldLabel>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {HOROSCOPE_OPTIONS.map((opt) => (
                <OptionCard key={opt.value} label={opt.label} sub={opt.sub} selected={data.horoscopePreference === opt.value} onClick={() => update({ horoscopePreference: opt.value })} />
              ))}
            </div>
          </Cell>
        </Grid>
      </Group>
    </div>
  );
}

// ─── Step 3 — Where & work ────────────────────────────────────────────────────
export function WhereWorkStep({ data, update }: StepProps) {
  const suggested = data.state === 'Kerala' ? KERALA_CITIES : [];
  return (
    <div>
      <Group title="Location">
        <Grid>
          <Cell span>
            <FieldLabel required>State</FieldLabel>
            <ChipGroup options={STATES} value={data.state} onChange={(v) => update({ state: v })} />
          </Cell>
          <Cell span>
            <FieldLabel required>City / District</FieldLabel>
            <TextField value={data.city} onChange={(v) => update({ city: v })} placeholder="e.g. Kochi" />
            {suggested.length > 0 && <div className="mt-2"><ChipGroup options={suggested} value={data.city} onChange={(v) => update({ city: v })} /></div>}
          </Cell>
        </Grid>
      </Group>

      <Group title="Work">
        <Grid>
          <Cell span>
            <FieldLabel required>Highest education</FieldLabel>
            <ChipGroup options={EDUCATION_OPTIONS} value={data.education} onChange={(v) => update({ education: v })} />
          </Cell>
          <Cell span>
            <FieldLabel required>Employed in</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {EMPLOYMENT_OPTIONS.map((opt) => (
                <OptionCard key={opt.value} label={opt.label} selected={data.employmentType === opt.value} onClick={() => update({ employmentType: opt.value })} />
              ))}
            </div>
          </Cell>
          <Cell span>
            <FieldLabel required>Occupation</FieldLabel>
            <TextField value={data.profession} onChange={(v) => update({ profession: v })} placeholder="e.g. Software Engineer" />
            <div className="mt-2"><ChipGroup options={OCCUPATION_CHIPS} value={data.profession} onChange={(v) => update({ profession: v })} /></div>
          </Cell>
          <Cell span>
            <FieldLabel optional>Annual income</FieldLabel>
            <ChipGroup options={INCOME_OPTIONS} value={data.income} onChange={(v) => update({ income: v })} toggleable />
          </Cell>
        </Grid>
      </Group>
    </div>
  );
}

// ─── Step 4 — Family & story ──────────────────────────────────────────────────
export function FamilyStoryStep({ data, update }: StepProps) {
  const famPrompt = getFamilyDescriptionPrompt(data.familyDescription);
  const bioReady = data.bio.trim().length >= BIO_MIN_CHARS;
  const bioNudge = generateBioNudge(data.bio);
  const [showPrompt, setShowPrompt] = useState(!!data.promptQuestion);

  return (
    <div>
      <Group title="Family">
        <Grid>
          <Cell span>
            <FieldLabel required>Family structure</FieldLabel>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {FAMILY_TYPE_OPTIONS.map((opt) => (
                <OptionCard key={opt.value} label={opt.label} sub={opt.sub} selected={data.familyType === opt.value} onClick={() => update({ familyType: opt.value })} />
              ))}
            </div>
          </Cell>
          <Cell span>
            <FieldLabel optional>Describe your family</FieldLabel>
            {data.familyDescription.length === 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {FAMILY_DESC_STARTERS.map((sx) => (
                  <button key={sx.label} type="button" onClick={() => update({ familyDescription: sx.text })}
                    className="rounded-full border border-line bg-cream px-3 py-1 text-xs text-muted transition hover:border-gold/50">
                    {sx.label}
                  </button>
                ))}
              </div>
            )}
            <TextArea value={data.familyDescription} onChange={(v) => update({ familyDescription: v })} maxLength={MAX_FAMILY_DESC} rows={3}
              placeholder="e.g. Close-knit family from Thrissur. Father is a retired civil servant…" />
            {famPrompt && <p className="mt-1 text-xs italic text-gold">{famPrompt}</p>}
          </Cell>
          <Cell>
            <FieldLabel optional>Father&apos;s occupation</FieldLabel>
            <ChipGroup options={FATHER_OCCUPATIONS} value={data.fatherOccupation} onChange={(v) => update({ fatherOccupation: v })} toggleable />
          </Cell>
          <Cell>
            <FieldLabel optional>Mother&apos;s occupation</FieldLabel>
            <ChipGroup options={MOTHER_OCCUPATIONS} value={data.motherOccupation} onChange={(v) => update({ motherOccupation: v })} toggleable />
          </Cell>
          <Cell>
            <FieldLabel>Brothers</FieldLabel>
            <div className="flex flex-wrap gap-1.5">{SIBLING_COUNTS.map((nx) => <Chip key={nx} label={nx} selected={data.brothers === nx} onClick={() => update({ brothers: nx })} />)}</div>
          </Cell>
          <Cell>
            <FieldLabel>Sisters</FieldLabel>
            <div className="flex flex-wrap gap-1.5">{SIBLING_COUNTS.map((nx) => <Chip key={nx} label={nx} selected={data.sisters === nx} onClick={() => update({ sisters: nx })} />)}</div>
          </Cell>
        </Grid>
      </Group>

      <Group title="Your story">
        <FieldLabel required>About you</FieldLabel>
        <p className="mb-2 text-xs italic text-muted">What matters to you? What does a good life feel like to you?</p>
        {data.bio.length === 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {BIO_STARTERS.map((sx) => (
              <button key={sx.label} type="button" onClick={() => update({ bio: sx.text })}
                className="rounded-full border border-line bg-cream px-3 py-1 text-xs text-muted transition hover:border-gold/50">
                {sx.label}
              </button>
            ))}
          </div>
        )}
        <TextArea value={data.bio} onChange={(v) => update({ bio: v })} maxLength={BIO_MAX_CHARS} rows={5}
          placeholder="Write a few lines about who you are, your values, and what you are looking for…" />
        {!bioReady && data.bio.length > 0 && <p className="mt-1 text-xs text-muted">A little more — at least {BIO_MIN_CHARS} characters.</p>}
        {bioReady && bioNudge && <p className="mt-1 text-xs italic text-gold">{bioNudge}</p>}

        <div className="mt-5">
          {!data.promptQuestion && !showPrompt && (
            <button type="button" onClick={() => setShowPrompt(true)}
              className="w-full rounded-lg border border-line bg-cream py-2.5 text-sm font-medium text-maroon transition hover:border-gold/50">
              + Add a personal note (optional)
            </button>
          )}
          {!data.promptQuestion && showPrompt && (
            <div>
              <FieldLabel optional>Pick a prompt</FieldLabel>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PROMPT_QUESTIONS.map((q) => (
                  <button key={q} type="button" onClick={() => update({ promptQuestion: q, promptAnswer: '' })}
                    className="rounded-lg border border-gold/30 bg-gold/[0.07] px-3.5 py-2.5 text-left text-sm italic text-ink/80 transition hover:bg-gold/10">
                    &ldquo;{q}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          )}
          {data.promptQuestion && (
            <div>
              <div className="mb-2 flex items-start justify-between gap-2">
                <span className="text-sm font-medium italic text-maroon">&ldquo;{data.promptQuestion}&rdquo;</span>
                <button type="button" onClick={() => update({ promptQuestion: '', promptAnswer: '' })} className="shrink-0 text-xs text-muted hover:text-ink/80">Remove</button>
              </div>
              <TextArea value={data.promptAnswer} onChange={(v) => update({ promptAnswer: v })} maxLength={PROMPT_MAX_CHARS} rows={2} placeholder="Write your answer…" />
            </div>
          )}
        </div>
      </Group>
    </div>
  );
}

// ─── Step 5 — Photos ──────────────────────────────────────────────────────────
type SlotState = { previewUrl: string; status: 'uploading' | 'done' | 'error'; url?: string };

export function PhotosStep({ data, update, uid }: StepProps & { uid: string }) {
  const [slots, setSlots] = useState<(SlotState | null)[]>(() =>
    Array.from({ length: MAX_PHOTOS }, (_, i) =>
      data.photos[i] ? { previewUrl: data.photos[i], status: 'done', url: data.photos[i] } : null,
    ),
  );
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const configured = isCloudinaryConfigured();

  function syncPhotos(next: (SlotState | null)[]) {
    update({ photos: next.filter((sx): sx is SlotState => !!sx?.url).map((sx) => sx.url!) });
  }
  async function pick(index: number, file: File) {
    const previewUrl = URL.createObjectURL(file);
    setSlots((prev) => { const next = [...prev]; next[index] = { previewUrl, status: 'uploading' }; return next; });
    try {
      const url = await uploadUserPhoto(file, uid, index);
      setSlots((prev) => { const next = [...prev]; next[index] = { previewUrl, status: 'done', url }; syncPhotos(next); return next; });
    } catch {
      setSlots((prev) => { const next = [...prev]; next[index] = { previewUrl, status: 'error' }; return next; });
    }
  }
  function remove(index: number) {
    setSlots((prev) => { const next = [...prev]; next[index] = null; syncPhotos(next); return next; });
  }

  return (
    <div>
      {!configured && (
        <p className="mb-4 rounded-lg border border-gold/30 bg-gold/10 px-3.5 py-2.5 text-xs text-[#7a5a2a]">
          Photo upload is not configured. Set <code>NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code> and{' '}
          <code>NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET</code> in <code>.env.local</code>.
        </p>
      )}
      <div className="grid grid-cols-3 gap-3 sm:max-w-md">
        {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
          const slot = slots[i];
          return (
            <div key={i} className="relative">
              <input ref={(el) => { inputRefs.current[i] = el; }} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) void pick(i, file); e.target.value = ''; }} />
              <button type="button" onClick={() => inputRefs.current[i]?.click()}
                className={`relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-xl border transition ${i === 0 ? 'border-gold' : 'border-line'} ${slot ? '' : 'bg-cream hover:border-gold/50'}`}>
                {slot
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={slot.previewUrl} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                  : <span className="flex flex-col items-center gap-1 text-muted"><span className="text-2xl">＋</span><span className="text-[11px]">{i === 0 ? 'Primary' : 'Add'}</span></span>}
                {slot?.status === 'uploading' && <span className="absolute inset-0 flex items-center justify-center bg-black/40"><span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" /></span>}
                {slot?.status === 'error' && <span className="absolute inset-0 flex items-center justify-center bg-red-600/70 text-xs font-medium text-white">Retry</span>}
              </button>
              {slot && <button type="button" onClick={() => remove(i)} className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-xs text-white" aria-label="Remove photo">✕</button>}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted">Natural light, face clearly visible. At least one photo to continue.</p>
    </div>
  );
}

// ─── Step 6 — Review ──────────────────────────────────────────────────────────
export function ReviewStep({ data }: { data: OnboardingData }) {
  const genderLabel = data.gender === 'male' ? 'Man' : data.gender === 'female' ? 'Woman' : '';
  let quality = '';
  try {
    quality = assessProfileQuality({ bio: data.bio, photos: data.photos, promptAnswer: data.promptAnswer, familyDescription: data.familyDescription }).note;
  } catch { quality = ''; }
  const lookingFor = data.lookingFor.gender === 'any'
    ? 'Open to meeting anyone'
    : `A ${data.lookingFor.gender === 'male' ? 'man' : 'woman'}${data.lookingFor.ageRange !== 'any' ? ` in the ${data.lookingFor.ageRange} age range` : ''}`;

  return (
    <div className="sm:grid sm:grid-cols-[minmax(0,18rem)_1fr] sm:gap-6">
      <div className="overflow-hidden rounded-2xl border border-line bg-cream shadow-sm">
        <div className="relative aspect-[4/5] w-full bg-ivory-deep">
          <ProfilePhoto src={data.photos[0] ?? ''} name={data.name} seed={data.name || 'me'} className="h-full w-full" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
            <div className="font-serif text-xl font-semibold text-white">{data.name || 'Your Name'}</div>
            <div className="text-sm text-white/90">{data.age > 0 ? `${data.age} years` : ''}{data.age > 0 && data.city ? '  ·  ' : ''}{data.city}</div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-4 sm:mt-0">
        <div className="flex flex-wrap gap-2">
          {data.profession && <Badge>{data.profession}</Badge>}
          <Badge>{data.religion}</Badge>
          {genderLabel && <Badge>{genderLabel}</Badge>}
          {data.city && <Badge>{data.city}</Badge>}
        </div>
        {data.bio && <div><SectionTitle>About</SectionTitle><p className="text-sm leading-relaxed text-ink/80">{data.bio}</p></div>}
        <div><SectionTitle>Looking for</SectionTitle><p className="text-sm text-ink/80">{lookingFor}</p></div>
        {quality && <p className="rounded-lg border border-line bg-ivory-deep px-4 py-3 text-sm italic text-muted">{quality}</p>}
        <p className="text-xs leading-relaxed text-muted">Your profile is reviewed before introductions begin. Introductions are private, mutual, and considered carefully.</p>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-line bg-ivory-deep px-3 py-1 text-xs font-medium text-ink/80">{children}</span>;
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{children}</div>;
}
