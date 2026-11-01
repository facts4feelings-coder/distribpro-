// Offline license key system: generation, verification and activation.
//
// Key format (32 chars payload + 8 checksum chars, grouped with dashes):
//   DIST-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXNN
// Payload: 24 random base32 chars + 8 chars encoding expiry (YYMMDDHH) + device limit (X=N no-limit, 1-9).
// Checksum: 8-char base32 hash of payload + APP_LICENSE_SECRET — makes guessing keys infeasible
// and lets any device verify a key fully offline. Only keys generated inside this app are valid.

const SECRET = 'DIST#RB-2026-v1::salt';

const B32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars, no ambiguous 0/1/I/O

function b32Encode(bytes: number[]): string {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function hash32(input: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function digest(input: string, rounds = 4): number[] {
  // Chain hashes so single-hash weaknesses don't apply; returns 8 chars per 4 rounds (2 per round).
  const out: number[] = [];
  let seed = input;
  for (let r = 0; r < rounds; r++) {
    const h = hash32(seed + `#${r}`);
    out.push((h >>> 24) & 255, (h >>> 16) & 255, (h >>> 8) & 255, h & 255);
    seed = `${h}`;
  }
  return out;
}

function checksumOf(payload: string): string {
  const bytes = digest(SECRET + '|' + payload, 4); // 16 bytes -> 26 b32 chars, we take 8
  return b32Encode(bytes).slice(0, 8);
}

export interface LicenseInfo {
  expiresAt: Date | null; // null = lifetime
  maxDevices: number; // 0 = unlimited
}

export interface KeyGenOptions {
  customerName: string;
  expiresAt: Date | null;
  maxDevices: number; // 0 = unlimited
}

const LIFETIME_MARKER = 'ZZZZZ';

function group(s: string): string {
  return (s.match(/.{1,4}/g) ?? []).join('-');
}

export function generateLicenseKey(opts: KeyGenOptions): string {
  // 12 random chars = 60 bits of entropy
  const rand: number[] = [];
  for (let i = 0; i < 8; i++) rand.push(Math.floor(Math.random() * 256));
  let randomPart = b32Encode(rand).slice(0, 12).padEnd(12, 'A');

  // Expiry: YYMMDDHH (base32) or '--------' for lifetime
  let expiryPart: string;
  if (opts.expiresAt) {
    const d = opts.expiresAt;
    const yy = String(d.getFullYear() % 100).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const raw = `${yy}${mm}${dd}${hh}`; // 8 decimal digits
    // Pack decimal digits as base32 of the numeric value (8 digits < 2^27)
    const num = parseInt(raw, 10);
    expiryPart = b32Encode([(num >>> 20) & 255, (num >>> 12) & 255, (num >>> 4) & 255]).slice(0, 5);
    // 8 decimal digits max 99999999 < 2^27, 3 bytes = 24 bits -> up to 5 b32 chars; pad to 5
    expiryPart = expiryPart.padEnd(5, 'A');
  } else {
    expiryPart = LIFETIME_MARKER;
  }

  // Devices: 1-9 or 0 for unlimited
  const devChar = opts.maxDevices >= 1 && opts.maxDevices <= 9 ? String(opts.maxDevices) : '0';

  // Payload = 12 random + 5 expiry + 1 device = 18 chars
  const payload = `${randomPart}${expiryPart}${devChar}`;

  // Truncate checksum conflict: payload must be 24 chars for a 32-char key.
  // Extend random to 18 chars so payload = 18 + 5 + 1 = 24.
  const extraRandNeeded = 24 - payload.length;
  if (extraRandNeeded > 0) {
    const more: number[] = [];
    for (let i = 0; i < 4; i++) more.push(Math.floor(Math.random() * 256));
    randomPart = (randomPart + b32Encode(more)).slice(0, 18);
    const fixedExpiry = payload.slice(12, 17);
    const fixedDev = payload.slice(17, 18);
    return group(`${randomPart}${fixedExpiry}${fixedDev}${checksumOf(`${randomPart}${fixedExpiry}${fixedDev}`)}`);
  }
  return group(`${payload}${checksumOf(payload)}`);
}

export function verifyLicenseKey(key: string): { valid: boolean; info?: LicenseInfo; error?: string } {
  const clean = key.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length !== 32) return { valid: false, error: 'Key must be 32 characters long' };
  const payload = clean.slice(0, 24);
  const check = clean.slice(24);
  if (checksumOf(payload) !== check) return { valid: false, error: 'Invalid license key' };

  // Decode device limit
  const devChar = payload[23];
  const maxDevices = devChar === '0' ? 0 : parseInt(devChar, 10);

  // Decode expiry
  const expPart = payload.slice(18, 23);
  let expiresAt: Date | null = null;
  if (expPart !== LIFETIME_MARKER) {
    // 5 b32 chars -> 25 bits -> 4 bytes, take low 3 bytes
    let bits = 0, value = 0, bytes: number[] = [];
    for (const ch of expPart) {
      const idx = B32.indexOf(ch);
      if (idx < 0) return { valid: false, error: 'Invalid license key' };
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    const num = ((bytes[0] << 16) | (bytes[1] << 8) | bytes[2]) >>> 0;
    if (num > 99999999) return { valid: false, error: 'Invalid license key' };
    const raw = String(num).padStart(8, '0');
    const yy = parseInt(raw.slice(0, 2), 10);
    const mm = parseInt(raw.slice(2, 4), 10);
    const dd = parseInt(raw.slice(4, 6), 10);
    const hh = parseInt(raw.slice(6, 8), 10);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || hh > 23) return { valid: false, error: 'Invalid license key' };
    expiresAt = new Date(2000 + yy, mm - 1, dd, hh, 59, 59);
  }

  return { valid: true, info: { expiresAt, maxDevices } };
}

// ---- Device activation storage (offline, per device) ----

const LS_ACTIVATION = 'distribpro_license_activation';

export function getDeviceId(): string {
  let id = localStorage.getItem('distribpro_device_id');
  if (!id) {
    const rand: number[] = [];
    for (let i = 0; i < 16; i++) rand.push(Math.floor(Math.random() * 256));
    id = b32Encode(rand);
    localStorage.setItem('distribpro_device_id', id);
  }
  return id;
}

interface StoredActivation {
  key: string;
  device_id: string;
  device_name: string;
  activated_at: string;
}

export function getStoredActivation(): StoredActivation | null {
  try {
    const raw = localStorage.getItem(LS_ACTIVATION);
    return raw ? (JSON.parse(raw) as StoredActivation) : null;
  } catch {
    return null;
  }
}

export function storeActivation(key: string): StoredActivation {
  const rec: StoredActivation = {
    key: key.toUpperCase().trim(),
    device_id: getDeviceId(),
    device_name: navigator.userAgent.slice(0, 120),
    activated_at: new Date().toISOString(),
  };
  localStorage.setItem(LS_ACTIVATION, JSON.stringify(rec));
  return rec;
}

export function clearActivation() {
  localStorage.removeItem(LS_ACTIVATION);
}

export interface LicenseState {
  status: 'active' | 'expired' | 'missing' | 'invalid';
  key?: string;
  expiresAt?: Date | null;
  daysLeft?: number | null;
}

export function checkLicense(): LicenseState {
  const act = getStoredActivation();
  if (!act) return { status: 'missing' };
  const v = verifyLicenseKey(act.key);
  if (!v.valid || !v.info) return { status: 'invalid', key: act.key };
  if (v.info.expiresAt && v.info.expiresAt.getTime() < Date.now()) {
    const daysLeft = 0;
    return { status: 'expired', key: act.key, expiresAt: v.info.expiresAt, daysLeft };
  }
  const daysLeft = v.info.expiresAt
    ? Math.ceil((v.info.expiresAt.getTime() - Date.now()) / 86400000)
    : null;
  return { status: 'active', key: act.key, expiresAt: v.info.expiresAt, daysLeft };
}
