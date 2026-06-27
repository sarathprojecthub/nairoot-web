// Beta verify — read the live project's Firebase Auth configuration (which
// sign-in providers are enabled + authorized domains) using the local
// firebase-tools credential. Confirms whether Phone Auth is ready for the website.
//   node scripts/verify-auth-config.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROJECT = 'nairoot-app';
const FB_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FB_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

const tokFile = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const refresh = JSON.parse(fs.readFileSync(tokFile, 'utf8')).tokens.refresh_token;
const tok = (await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ client_id: FB_CLIENT_ID, client_secret: FB_CLIENT_SECRET, refresh_token: refresh, grant_type: 'refresh_token' }),
})).json()).access_token;

const res = await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT}/config`, {
  headers: { Authorization: `Bearer ${tok}` },
});
const cfg = await res.json();
if (!res.ok) { console.log('✗ Could not read auth config (HTTP ' + res.status + '):', JSON.stringify(cfg).slice(0, 200)); process.exit(1); }

const phone = cfg?.signIn?.phoneNumber?.enabled === true;
const anon = cfg?.signIn?.anonymous?.enabled === true;
const domains = cfg?.authorizedDomains ?? [];

console.log('Firebase Auth config —', PROJECT);
console.log(`  ${phone ? '✓' : '✗'} Phone provider enabled: ${phone}`);
console.log(`  ${anon ? '✓' : '○'} Anonymous provider enabled: ${anon} (Android uses this)`);
console.log(`  authorized domains (${domains.length}): ${domains.join(', ')}`);
console.log(`  test phone numbers configured: ${(cfg?.signIn?.phoneNumber?.testPhoneNumbers && Object.keys(cfg.signIn.phoneNumber.testPhoneNumbers).length) || 0}`);
process.exitCode = phone ? 0 : 2;
