/**
 * LabLock — Cryptographic Password Hashing
 *
 * Uses PBKDF2 via the Web Crypto API (crypto.subtle).
 * Zero external dependencies. Runs in the service worker context.
 *
 * Security properties:
 * - 600,000 PBKDF2 iterations (OWASP 2025 recommended minimum)
 * - 16-byte cryptographically random salt per password
 * - SHA-256 as the underlying hash function
 * - Constant-time comparison to prevent timing attacks
 * - No plaintext passwords ever stored
 */

import { CRYPTO_CONFIG, type PasswordData } from '../types';

/**
 * Convert a Uint8Array to a hex string.
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert a hex string back to a Uint8Array.
 */
function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Derive a PBKDF2 key from a password and salt.
 * Returns the raw derived bits as an ArrayBuffer.
 */
async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer as BufferSource,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  return crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: CRYPTO_CONFIG.HASH_ALGORITHM,
    },
    keyMaterial,
    CRYPTO_CONFIG.KEY_LENGTH_BITS
  );
}

/**
 * Hash a password using PBKDF2 with a fresh random salt.
 *
 * @returns PasswordData containing the hex-encoded hash, salt, and iteration count.
 */
export async function hashPassword(password: string): Promise<PasswordData> {
  const saltArray = new Uint8Array(CRYPTO_CONFIG.SALT_BYTES);
  const salt = crypto.getRandomValues(saltArray
  );
  const derived = await deriveKey(password, salt, CRYPTO_CONFIG.ITERATIONS);

  return {
    hash: bufferToHex(derived),
    salt: bufferToHex(new Uint8Array(salt).buffer as ArrayBuffer),
    iterations: CRYPTO_CONFIG.ITERATIONS,
  };
}

/**
 * Verify a password against stored hash data.
 * Uses constant-time comparison to prevent timing attacks.
 *
 * @returns true if the password matches, false otherwise.
 */
export async function verifyPassword(
  password: string,
  stored: PasswordData
): Promise<boolean> {
  const salt = hexToBuffer(stored.salt);
  const derived = await deriveKey(password, salt, stored.iterations);
  const derivedHex = bufferToHex(derived);

  return constantTimeEqual(derivedHex, stored.hash);
}

/**
 * Constant-time string comparison to prevent timing side-channel attacks.
 * Both strings must be the same length (which they always are for our hex hashes).
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Generate a cryptographically random recovery key.
 * Returns a human-readable key in the format: XXXX-XXXX-XXXX-XXXX
 */
export function generateRecoveryKey(): string {
  const bytesArray = new Uint8Array(16);
  const bytes = crypto.getRandomValues(bytesArray);
  const hex = bufferToHex(new Uint8Array(bytes).buffer as ArrayBuffer).toUpperCase();
  // Format as XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
  return hex.match(/.{4}/g)!.join('-');
}

/**
 * Compute SHA-256 hash of arbitrary data (used for integrity checks).
 */
export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return bufferToHex(hash);
}
