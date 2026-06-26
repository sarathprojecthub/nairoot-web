// QA cleanup. Removes regression "QA <role> <X>" actor data via the admin
// console (cascades intros/matches/conversations, which are delete:false for
// clients). Pass --seed to ALSO delete the qa-01…qa-12 seed dataset.
//
//   node --env-file=.env.local scripts/qa-cleanup.mjs [--seed]
const BASE = process.env.QA_BASE_URL || 'http://localhost:3210';
const SECRET = process.env.DEV_ADMIN_SECRET;
const alsoSeed = process.argv.includes('--seed');
if (!SECRET) { console.error('DEV_ADMIN_SECRET missing'); process.exit(1); }

async function api(action, payload = {}) {
  const res = await fetch(`${BASE}/api/dev`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-dev-secret': SECRET },
    body: JSON.stringify({ action, payload }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(`${action}: ${json.error || res.status}`);
  return json.data;
}

const profiles = await api('listProfiles', {});
const users = await api('listUsers', {});
const ids = new Set();
for (const d of profiles) {
  const name = String(d.data.name ?? '');
  if (name.startsWith('QA ')) ids.add(d.id);
  if (alsoSeed && d.id.startsWith('qa-')) ids.add(d.id);
}
// also catch actor user docs with no profile
for (const u of users) if (String(u.data.phone ?? '').startsWith('+9100000000')) ids.add(u.id);

console.log(`Cleaning ${ids.size} uid(s)${alsoSeed ? ' (incl. seed dataset)' : ''}…`);
for (const uid of ids) {
  const r = await api('deleteUserCascade', { uid });
  console.log(`  ${uid.slice(0, 10)}…`, JSON.stringify(r));
}
console.log('Done.');
process.exit(0);
