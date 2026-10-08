/**
 * Cryptographic services for device fingerprints, safety verification codes, and hashes.
 */

export async function computeSha256(data: string | Uint8Array): Promise<string> {
  const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer as BufferSource);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function formatFingerprint(rawHash: string): string {
  const clean = rawHash.toUpperCase().slice(0, 32);
  const pairs: string[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    pairs.push(clean.substr(i, 2));
  }
  return pairs.slice(0, 8).join(':');
}

export function generateSafetyCode(seedA: string, seedB: string): string {
  // Generates deterministic 6-digit security code for visual pair verification
  let hash = 0;
  const combined = [seedA, seedB].sort().join('::');
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const abs = Math.abs(hash) % 1000000;
  const str = abs.toString().padStart(6, '7');
  return `${str.slice(0, 3)} ${str.slice(3, 6)}`;
}

export function generateRandomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
}

export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
