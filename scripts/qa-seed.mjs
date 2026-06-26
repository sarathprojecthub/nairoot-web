// P1-QA dataset seeder — creates a clean, realistic test dataset through the
// admin console backend (/api/dev createProfile). Idempotent: fixed uids qa-01…
//
//   1. PORT=3210 npm run start   (server must be running, firebase login present)
//   2. node --env-file=.env.local scripts/qa-seed.mjs
//
// Leaves the profiles in place for external testers. Remove later via the
// admin console "Delete test data" (uid qa-01 … qa-12) or scripts/qa-cleanup.mjs.
const BASE = process.env.QA_BASE_URL || 'http://localhost:3210';
const SECRET = process.env.DEV_ADMIN_SECRET;
if (!SECRET) { console.error('DEV_ADMIN_SECRET missing — run with --env-file=.env.local'); process.exit(1); }

const portrait = (g, n) => `https://randomuser.me/api/portraits/${g === 'female' ? 'women' : 'men'}/${n}.jpg`;

// 12 profiles: varied age/location/profession/religion/gender, mix of complete
// and intentionally incomplete (no photo / sparse bio / missing education).
const PROFILES = [
  { uid: 'qa-01', name: 'Arjun Menon', age: 29, gender: 'male', city: 'Kochi', state: 'Kerala', profession: 'Software Engineer', education: 'B.Tech / B.E', religion: 'Hindu', height: `5'10"`, bio: 'Grounded in my work and close to my family. I value calm, honest conversations and weekend trips back home to Thrissur.', family: 'Close-knit nuclear family; father retired from KSEB, mother a schoolteacher.', photos: [portrait('male', 11)], complete: true },
  { uid: 'qa-02', name: 'Lakshmi Nair', age: 27, gender: 'female', city: 'Thiruvananthapuram', state: 'Kerala', profession: 'Doctor', education: 'MBBS', religion: 'Hindu', height: `5'4"`, bio: 'Paediatric resident who loves Carnatic music and long temple walks. Looking for someone kind and steady.', family: 'Joint family with deep roots in Trivandrum.', photos: [portrait('female', 21)], complete: true },
  { uid: 'qa-03', name: 'Rahul Pillai', age: 32, gender: 'male', city: 'Bangalore', state: 'Karnataka', profession: 'Product Manager', education: 'MBA', religion: 'Hindu', height: `5'9"`, bio: 'Keralite in Bangalore. Into cycling, filter coffee, and building things. Family means everything to me.', family: 'Nuclear family from Kollam.', photos: [portrait('male', 32)], complete: true },
  { uid: 'qa-04', name: 'Ann Mary Thomas', age: 28, gender: 'female', city: 'Kottayam', state: 'Kerala', profession: 'Architect', education: 'B.Arch', religion: 'Christian', height: `5'5"`, bio: 'Architect who sketches old churches for fun. Quiet, curious, and close to my parents.', family: 'Syrian Christian family from Kottayam.', photos: [portrait('female', 44)], complete: true },
  { uid: 'qa-05', name: 'Fathima Beevi', age: 26, gender: 'female', city: 'Kozhikode', state: 'Kerala', profession: 'Lawyer', education: 'LLB', religion: 'Muslim', height: `5'3"`, bio: 'Practising at the Kozhikode bar. I read a lot and cook even more. Seeking a respectful, ambitious partner.', family: 'Supportive family in Kozhikode.', photos: [portrait('female', 56)], complete: true },
  { uid: 'qa-06', name: 'Vivek Iyer', age: 35, gender: 'male', city: 'Chennai', state: 'Tamil Nadu', profession: 'Chartered Accountant', education: 'CA', religion: 'Hindu', height: `5'8"`, bio: 'Numbers by day, veena by evening. Traditional at heart, modern in outlook.', family: 'Tam-Bram family settled in Chennai.', photos: [portrait('male', 67)], complete: true },
  { uid: 'qa-07', name: 'Sneha Reddy', age: 30, gender: 'female', city: 'Hyderabad', state: 'Telangana', profession: 'Data Scientist', education: 'M.Tech', religion: 'Hindu', height: `5'6"`, bio: 'ML engineer who hikes on weekends. Looking for an equal partnership built on trust.', family: 'Nuclear family from Hyderabad.', photos: [portrait('female', 68)], complete: true },
  { uid: 'qa-08', name: 'Joseph Kurian', age: 38, gender: 'male', city: 'Mumbai', state: 'Maharashtra', profession: 'Entrepreneur', education: 'MBA', religion: 'Christian', height: `6'0"`, bio: 'Runs a logistics startup. Believes in faith, family, and second chances.', family: 'Extended family from Pala, now in Mumbai.', photos: [portrait('male', 75)], complete: true },
  // ── intentionally incomplete profiles ──
  { uid: 'qa-09', name: 'Meera Krishnan', age: 25, gender: 'female', city: 'Palakkad', state: 'Kerala', profession: 'Teacher', religion: 'Hindu', bio: 'New here.', photos: [portrait('female', 79)], complete: false }, // no education, sparse bio
  { uid: 'qa-10', name: 'Aditya Varma', age: 41, gender: 'male', city: 'Pune', state: 'Maharashtra', profession: 'Civil Servant', religion: 'Hindu', complete: false }, // no photo, no bio, no education
  { uid: 'qa-11', name: 'Riya Jain', age: 24, gender: 'female', city: 'Delhi', state: 'Delhi', profession: 'Designer', education: 'B.Des', religion: 'Jain', complete: false }, // no photo, no bio
  { uid: 'qa-12', name: 'Nikhil Kumar', age: 33, gender: 'male', city: 'Ernakulam', state: 'Kerala', profession: '', religion: 'Hindu', bio: 'Looking to settle down close to home.', complete: false }, // no profession, no photo
];

async function api(action, payload) {
  const res = await fetch(`${BASE}/api/dev`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-dev-secret': SECRET },
    body: JSON.stringify({ action, payload }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(`${action}: ${json.error || res.status}`);
  return json.data;
}

console.log('Seeding QA dataset →', BASE, '\n');
let ok = 0;
for (const p of PROFILES) {
  const { complete, ...input } = p;
  await api('createProfile', { input: { ...input, isVisible: true } });
  console.log(`  ✓ ${p.uid}  ${p.name.padEnd(20)} ${String(p.age).padStart(2)}  ${p.religion.padEnd(9)} ${complete ? 'complete' : 'INCOMPLETE'}`);
  ok++;
}

// Confirm they land in the shared Discover query.
const visible = await api('listProfiles', {});
const seeded = visible.filter((d) => d.id.startsWith('qa-'));
console.log(`\nSeeded ${ok}/${PROFILES.length}. Discover-visible qa- profiles: ${seeded.length}`);
console.log('Ages:', seeded.map((d) => d.data.age).sort((a, b) => a - b).join(', '));
process.exit(0);
