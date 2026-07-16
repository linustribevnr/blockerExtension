/**
 * LabLock — Typed Storage Layer
 *
 * Type-safe wrappers around chrome.storage.local and chrome.storage.session.
 * Handles schema versioning, integrity checking, and default values.
 *
 * Storage layout:
 * - chrome.storage.local: persistent config (password hash, whitelist, flags)
 * - chrome.storage.session: ephemeral state (rate limiting timestamps)
 */

import { sha256 } from './crypto';
import {
  STORAGE_VERSION,
  type LocalStorageSchema,
  type PasswordData,
  type RecoveryKeyData,
  type WhitelistEntry,
} from '../types';

/* ─── Default Values ─── */

const DEFAULTS: LocalStorageSchema = {
  setupComplete: false,
  lockdownActive: false,
  passwordData: { hash: '', salt: '', iterations: 0 },
  recoveryKeyData: null,
  whitelist: [],
  whitelistIntegrity: '',
  schemaVersion: STORAGE_VERSION,
};

/* ─── Core Read/Write ─── */

/**
 * Read the full local storage state, filling in defaults for missing keys.
 */
export async function getLocalStorage(): Promise<LocalStorageSchema> {
  const data = await chrome.storage.local.get(Object.keys(DEFAULTS));
  return { ...DEFAULTS, ...data } as LocalStorageSchema;
}

/**
 * Write partial updates to local storage.
 */
export async function setLocalStorage(
  updates: Partial<LocalStorageSchema>
): Promise<void> {
  await chrome.storage.local.set(updates);
}

/* ─── Setup State ─── */

export async function isSetupComplete(): Promise<boolean> {
  const store = await getLocalStorage();
  return store.setupComplete;
}

export async function markSetupComplete(): Promise<void> {
  await setLocalStorage({ setupComplete: true });
}

export async function isLockdownActive(): Promise<boolean> {
  const store = await getLocalStorage();
  return store.lockdownActive;
}

export async function setLockdownActive(active: boolean): Promise<void> {
  await setLocalStorage({ lockdownActive: active });
}

/* ─── Password ─── */

export async function storePasswordData(
  passwordData: PasswordData
): Promise<void> {
  await setLocalStorage({ passwordData });
}

export async function getPasswordData(): Promise<PasswordData> {
  const store = await getLocalStorage();
  return store.passwordData;
}

export async function storeRecoveryKeyData(
  recoveryKeyData: RecoveryKeyData
): Promise<void> {
  await setLocalStorage({ recoveryKeyData });
}

export async function getRecoveryKeyData(): Promise<RecoveryKeyData | null> {
  const store = await getLocalStorage();
  return store.recoveryKeyData;
}

/* ─── Whitelist ─── */

/**
 * Compute the integrity hash of the current whitelist.
 * Used to detect tampering.
 */
async function computeWhitelistIntegrity(
  whitelist: WhitelistEntry[]
): Promise<string> {
  const serialized = JSON.stringify(
    whitelist.map((e) => e.domain).sort()
  );
  return sha256(serialized);
}

/**
 * Get the whitelist, verifying its integrity.
 * If integrity check fails, returns null (caller should re-lockdown).
 */
export async function getWhitelist(): Promise<WhitelistEntry[] | null> {
  const store = await getLocalStorage();
  const expected = store.whitelistIntegrity;
  const actual = await computeWhitelistIntegrity(store.whitelist);

  if (expected && expected !== actual) {
    // Integrity violation — whitelist was tampered with
    return null;
  }

  return store.whitelist;
}

/**
 * Get the whitelist without integrity verification.
 * Used during setup before integrity has been established.
 */
export async function getWhitelistRaw(): Promise<WhitelistEntry[]> {
  const store = await getLocalStorage();
  return store.whitelist;
}

/**
 * Add a domain to the whitelist and update the integrity hash.
 */
export async function addDomain(domain: string): Promise<WhitelistEntry[]> {
  const store = await getLocalStorage();
  const normalized = normalizeDomain(domain);

  // Prevent duplicates
  if (store.whitelist.some((e) => e.domain === normalized)) {
    return store.whitelist;
  }

  const entry: WhitelistEntry = {
    domain: normalized,
    addedAt: new Date().toISOString(),
  };

  const updated = [...store.whitelist, entry];
  const integrity = await computeWhitelistIntegrity(updated);

  await setLocalStorage({
    whitelist: updated,
    whitelistIntegrity: integrity,
  });

  return updated;
}

/**
 * Remove a domain from the whitelist and update the integrity hash.
 */
export async function removeDomain(
  domain: string
): Promise<WhitelistEntry[]> {
  const store = await getLocalStorage();
  const normalized = normalizeDomain(domain);

  const updated = store.whitelist.filter((e) => e.domain !== normalized);
  const integrity = await computeWhitelistIntegrity(updated);

  await setLocalStorage({
    whitelist: updated,
    whitelistIntegrity: integrity,
  });

  return updated;
}

/**
 * Replace the entire whitelist (used during setup).
 */
export async function setWhitelist(
  domains: string[]
): Promise<WhitelistEntry[]> {
  const entries: WhitelistEntry[] = domains
    .map(normalizeDomain)
    .filter((d, i, arr) => arr.indexOf(d) === i) // dedupe
    .map((domain) => ({
      domain,
      addedAt: new Date().toISOString(),
    }));

  const integrity = await computeWhitelistIntegrity(entries);

  await setLocalStorage({
    whitelist: entries,
    whitelistIntegrity: integrity,
  });

  return entries;
}

/* ─── Helpers ─── */

/**
 * Normalize a domain input:
 * - Trim whitespace
 * - Remove leading wildcards (*. prefix) — we handle subdomains via requestDomains
 * - Remove protocol prefixes (http://, https://)
 * - Remove trailing slashes and paths
 * - Convert to lowercase
 */
function normalizeDomain(input: string): string {
  let domain = input.trim().toLowerCase();

  // Remove protocol
  domain = domain.replace(/^https?:\/\//, '');

  // Remove wildcard prefix (we handle subdomains in DNR rules)
  domain = domain.replace(/^\*\./, '');

  // Remove path/query/hash
  domain = domain.split('/')[0] ?? domain;
  domain = domain.split('?')[0] ?? domain;
  domain = domain.split('#')[0] ?? domain;

  // Remove trailing dot
  domain = domain.replace(/\.$/, '');

  return domain;
}
