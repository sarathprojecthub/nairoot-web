// Validates the India state/district option data used by onboarding.
//
//   npx tsx scripts/validate-districts.ts
//   (also wired up as: npm run validate:districts)
//
// Checks (per the district-data acquisition task):
//   - exactly 36 State/UT mappings
//   - every onboarding State (STATE_OPTIONS) has a mapping, no unknown keys
//   - no empty arrays, no duplicate names, no blank names
//   - alphabetical ordering within each state
//   - total district count equals the verified LGD total (784)
//   - Tamil Nadu is not the old 3-item sample
//   - no two large (>= 10 district) state arrays are accidentally identical
import { STATE_OPTIONS } from '../src/lib/onboarding/options';
import { INDIA_DISTRICTS_BY_STATE } from '../src/lib/onboarding/indiaDistricts';

const EXPECTED_TOTAL_DISTRICTS = 784;
const EXPECTED_STATE_COUNT = 36;

const failures: string[] = [];
function fail(message: string) {
  failures.push(message);
}

const stateKeys = Object.keys(INDIA_DISTRICTS_BY_STATE);
const stateOptionLabels = STATE_OPTIONS.map((option) => option.value);

if (stateKeys.length !== EXPECTED_STATE_COUNT) {
  fail(`Expected exactly ${EXPECTED_STATE_COUNT} state/UT mappings, found ${stateKeys.length}.`);
}

const stateOptionSet = new Set(stateOptionLabels);
for (const key of stateKeys) {
  if (!stateOptionSet.has(key)) {
    fail(`Unknown state key in INDIA_DISTRICTS_BY_STATE: "${key}" (not present in STATE_OPTIONS).`);
  }
}

const districtKeySet = new Set(stateKeys);
for (const label of stateOptionLabels) {
  if (!districtKeySet.has(label)) {
    fail(`STATE_OPTIONS entry "${label}" has no matching entry in INDIA_DISTRICTS_BY_STATE.`);
  }
}

let totalDistricts = 0;
const arraySignatures = new Map<string, string>();

for (const [state, districts] of Object.entries(INDIA_DISTRICTS_BY_STATE)) {
  if (districts.length === 0) {
    fail(`${state}: district array is empty.`);
    continue;
  }

  totalDistricts += districts.length;

  const seen = new Set<string>();
  for (const name of districts) {
    if (!name || !name.trim()) {
      fail(`${state}: contains a blank district name.`);
      continue;
    }
    if (name !== name.trim() || /\s{2,}/.test(name)) {
      fail(`${state}: "${name}" has leading/trailing or repeated whitespace.`);
    }
    if (seen.has(name)) {
      fail(`${state}: duplicate district name "${name}".`);
    }
    seen.add(name);
  }

  const sorted = [...districts].sort((a, b) => a.localeCompare(b));
  if (JSON.stringify(sorted) !== JSON.stringify(districts)) {
    fail(`${state}: district array is not alphabetically ordered.`);
  }

  if (districts.length >= 10) {
    const signature = JSON.stringify([...districts].sort());
    const clashingState = arraySignatures.get(signature);
    if (clashingState) {
      fail(`${state} and ${clashingState} have byte-identical district arrays (${districts.length} entries each) — likely a copy-paste error.`);
    } else {
      arraySignatures.set(signature, state);
    }
  }
}

const tamilNadu = INDIA_DISTRICTS_BY_STATE['Tamil Nadu'] ?? [];
if (tamilNadu.length <= 3) {
  fail(`Tamil Nadu still looks like the old 3-item sample (${tamilNadu.length} entries) — expected the full district list.`);
}
if (!(tamilNadu.length >= 30)) {
  fail(`Tamil Nadu has only ${tamilNadu.length} districts — expected close to the current official count.`);
}

if (totalDistricts !== EXPECTED_TOTAL_DISTRICTS) {
  fail(`Total district count is ${totalDistricts}, expected the verified LGD total of ${EXPECTED_TOTAL_DISTRICTS}.`);
}

if (failures.length > 0) {
  console.error(`✗ validate:districts FAILED (${failures.length} issue${failures.length === 1 ? '' : 's'}):\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`✓ validate:districts passed — ${stateKeys.length} states/UTs, ${totalDistricts} districts total.`);
