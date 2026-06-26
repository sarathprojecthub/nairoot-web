// ─────────────────────────────────────────────────────────────────────────────
// Profile quality + bio/family guidance.
//
// Ported from Android src/services/profileQualityService.ts and
// profileWritingService.ts so the website writes the SAME profileQuality value
// (DbProfile.profileQuality) that Android computes for an equivalent profile.
// Keep the scoring identical across clients.
// ─────────────────────────────────────────────────────────────────────────────

export type ProfileShape = {
  bio?: string;
  photos?: string[];
  profession?: string;
  education?: string;
  city?: string;
  height?: string;
  family?: string;
  lifestyle?: string[];
  lookingFor?: string;
  verifiedFields?: string[];
  activityStatus?: 'active-this-week' | 'active-recently' | 'paused';
  familyType?: string;
  prompt?: { question: string; answer: string };
};

function photoCount(p: ProfileShape): number {
  return p.photos?.length ?? 0;
}

function hasFamilyInfo(p: ProfileShape): boolean {
  return !!(p.family || p.familyType);
}

function bioLen(p: ProfileShape): number {
  return (p.bio ?? '').trim().length;
}

// ─── Completion (0–100) ───────────────────────────────────────────────────────
export function calculateProfileCompletion(profile: ProfileShape): number {
  let score = 0;
  const photos = photoCount(profile);
  const len = bioLen(profile);

  if (photos >= 1) score += 20;
  if (photos >= 2) score += 5;
  if (len > 0) score += 5;
  if (len > 50) score += 10;
  if (len > 150) score += 5;
  if (profile.profession) score += 10;
  if (profile.education) score += 10;
  if (profile.city) score += 5;
  if (hasFamilyInfo(profile)) score += 10;
  if ((profile.lifestyle?.length ?? 0) > 0) score += 8;
  if (profile.lookingFor) score += 7;
  if (profile.height) score += 5;
  if ((profile.prompt?.answer?.length ?? 0) > 20) score += 5;

  return Math.min(score, 100);
}

// ─── Quality (0–100) — written to DbProfile.profileQuality ────────────────────
export function calculateProfileQuality(profile: ProfileShape): number {
  const completion = calculateProfileCompletion(profile);
  const verified = profile.verifiedFields ?? [];
  const photos = photoCount(profile);
  const len = bioLen(profile);

  const photoBonus = photos >= 2 ? 8 : 0;
  const verifiedBonus = Math.min(verified.length * 5, 15);
  const bioDepthBonus = len > 200 ? 5 : 0;

  return Math.min(Math.round(completion * 0.72 + photoBonus + verifiedBonus + bioDepthBonus), 100);
}

// ─── Preview quality note — ported from profileWritingService.assessProfileQuality
export type PreviewQuality = 'warm' | 'good' | 'sparse';

export function assessProfileQuality(data: {
  bio?: string;
  photos?: string[];
  promptAnswer?: string;
  familyDescription?: string;
}): { quality: PreviewQuality; note: string } {
  const bioGood = (data.bio?.trim().length ?? 0) >= 100;
  const hasPhoto = (data.photos?.length ?? 0) > 0;
  const hasPrompt = (data.promptAnswer?.trim().length ?? 0) > 10;
  const hasFamily = (data.familyDescription?.trim().length ?? 0) > 20;

  const score = [bioGood, hasPhoto, hasPrompt, hasFamily].filter(Boolean).length;

  if (score >= 3) {
    return {
      quality: 'warm',
      note: 'Your profile feels thoughtful and warm. Families will find it easy to connect with you.',
    };
  }
  if (score === 2) {
    if (!bioGood) {
      return {
        quality: 'good',
        note: 'A little more about your daily life could help introductions feel more personal.',
      };
    }
    if (!hasPrompt && !hasFamily) {
      return {
        quality: 'good',
        note: 'Adding a personal note or family context helps introductions feel more natural.',
      };
    }
    return {
      quality: 'good',
      note: 'Your profile is thoughtful. A few more details could make it feel even warmer.',
    };
  }
  return {
    quality: 'sparse',
    note: 'A bit more about who you are will help families feel oriented before an introduction.',
  };
}

// ─── Bio nudges — ported from profileWritingService ───────────────────────────
const RESUME_SIGNALS = [
  'currently working', 'years of experience', 'multinational', 'corporate',
  'graduated from', 'worked at', 'working at', 'employee',
  'b.tech', 'b.e.', 'mba', 'phd', 'mca',
];
const CLICHE_SIGNALS = [
  'fun-loving', 'fun loving', 'hardworking', 'simple person',
  'family-oriented', 'family oriented', 'down to earth',
  'easygoing', 'easy going', 'nature lover', 'travel lover',
  'foodie', 'positive attitude', 'life partner', 'soulmate',
  'other half', 'better half', 'i am a simple', 'i am simple',
];

export function generateBioNudge(bio: string): string | null {
  if (bio.trim().length < 30) return null;
  const lower = bio.toLowerCase();
  const isShort = bio.trim().length > 0 && bio.trim().length < 80;
  const isResumeLike = RESUME_SIGNALS.some((s) => lower.includes(s));
  const hasCliche = CLICHE_SIGNALS.some((s) => lower.includes(s));
  if (isResumeLike) return 'Simple and honest usually reads better than overly formal.';
  if (hasCliche) return 'A few specific, personal details help introductions feel more natural.';
  if (isShort) return 'Profiles feel warmer when they include everyday details.';
  return null;
}

// ─── Family description prompt — ported from profileWritingService ────────────
const FAMILY_WARMTH_PROMPTS = [
  'What kind of home environment did you grow up in?',
  'What would your family say matters most to them?',
  'What does a typical family gathering look like for you?',
];

export function getFamilyDescriptionPrompt(desc: string): string | null {
  const len = desc.trim().length;
  if (len > 0 && len < 50) {
    return FAMILY_WARMTH_PROMPTS[len % FAMILY_WARMTH_PROMPTS.length];
  }
  return null;
}
