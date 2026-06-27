// Beta verify — Cloudinary unsigned upload actually works with the configured
// cloud + preset (the path website onboarding/profile photos use).
//   node --env-file=.env.local scripts/verify-cloudinary.mjs
const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
if (!CLOUD || !PRESET) { console.log('✗ Cloudinary env not set'); process.exit(1); }

// 1×1 transparent PNG as a data URI (Cloudinary accepts data URIs in `file`).
const onePx = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const form = new FormData();
form.append('file', onePx);
form.append('upload_preset', PRESET);
form.append('public_id', `bandhan/qa/beta-verify-${Date.now()}`);

const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: 'POST', body: form });
const body = await res.json();
if (res.ok && body.secure_url) {
  console.log(`✓ Cloudinary unsigned upload OK (cloud=${CLOUD}, preset=${PRESET})`);
  console.log(`  ${body.secure_url}`);
  process.exitCode = 0;
} else {
  console.log(`✗ Cloudinary upload FAILED (HTTP ${res.status}): ${JSON.stringify(body.error ?? body).slice(0, 200)}`);
  process.exitCode = 1;
}
