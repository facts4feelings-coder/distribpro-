// Generate a DistribPro license key from the command line.
// Usage: node scripts/keygen.mjs [customerName] [days (0 = lifetime)] [maxDevices (0 = unlimited)]
// Uses the exact same code as the in-app License Key Generator (src/lib/license.ts).
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = await build({
  entryPoints: [root + 'src/lib/license.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'silent',
});
const mod = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));

const [name = 'Customer', daysArg = '0', devArg = '1'] = process.argv.slice(2);
const days = Number(daysArg) || 0;
const maxDevices = Math.max(0, Math.min(9, Number(devArg) || 0));
const expiresAt = days > 0 ? new Date(Date.now() + days * 86400000) : null;

const key = mod.generateLicenseKey({ customerName: name, expiresAt, maxDevices });
const check = mod.verifyLicenseKey(key);
if (!check.valid) {
  console.error('Key verify fail hui: ' + check.error);
  process.exit(1);
}
console.log('');
console.log('  Customer : ' + name);
console.log('  Expiry   : ' + (expiresAt ? expiresAt.toLocaleString() : 'Lifetime'));
console.log('  Devices  : ' + (maxDevices === 0 ? 'Unlimited' : maxDevices));
console.log('');
console.log('  LICENSE KEY:  ' + key);
console.log('');
