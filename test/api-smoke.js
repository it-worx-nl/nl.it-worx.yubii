// Read-only smoke test against a real hub. Reads credentials from ~/.yubii.env (never commit them).
'use strict';
const fs = require('fs'); const os = require('os'); const path = require('path');
const HC3Client = require('../lib/HC3Client');
const { classify } = require('../lib/classify');
const env = Object.fromEntries(fs.readFileSync(path.join(os.homedir(), '.yubii.env'), 'utf8')
  .split('\n').filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
(async () => {
  const c = new HC3Client({ host: env.YUBII_HOST, username: env.YUBII_USER, password: env.YUBII_PASS });
  const info = await c.getInfo();
  console.log('hub', info.serialNumber, info.platform, info.softVersion);
  for (const d of await c.getDevices()) {
    const k = classify(d);
    if (k) console.log(d.id, d.name, '→', k.driver, k.capabilities.join(','));
  }
})().catch((e) => { console.error('FAILED', e.code || '', e.message); process.exit(1); });
