/**
 * LabLock Extension — Core Type Definitions
 *
 * Every type used across the extension is defined here.
 * No `any` types. No implicit types. Strict mode enforced.
 */

/* ─── Storage Schemas ─── */

export interface PasswordData {
  /** PBKDF2-derived hash as hex string */
  hash: string;
  /** Random 16-byte salt as hex string */
  salt: string;
  /** Number of PBKDF2 iterations used (for future-proofing) */
  iterations: number;
}

export interface RecoveryKeyData {
  /** One-time recovery key hash (same PBKDF2 params) */
  hash: string;
  salt: string;
  iterations: number;
}

export interface WhitelistEntry {
  /** The domain pattern, e.g. "hackerrank.com" */
  domain: string;
  /** When this entry was added (ISO timestamp) */
  addedAt: string;
}

export interface LocalStorageSchema {
  /** Whether initial setup has been completed */
  setupComplete: boolean;
  /** Whether lockdown mode is currently active */
  lockdownActive: boolean;
  /** Admin master password (hashed) */
  passwordData: PasswordData;
  /** One-time recovery key (hashed) */
  recoveryKeyData: RecoveryKeyData | null;
  /** Whitelisted domain entries */
  whitelist: WhitelistEntry[];
  /** SHA-256 integrity hash of the serialized whitelist */
  whitelistIntegrity: string;
  /** Storage schema version for future migrations */
  schemaVersion: number;
}

export interface SessionStorageSchema {
  /** Timestamp of the last failed password attempt */
  lastFailedAttempt: number | null;
  /** Count of consecutive failed attempts */
  failedAttemptCount: number;
}

/* ─── Message Protocol ─── */

export type MessageType =
  | 'VERIFY_PASSWORD'
  | 'SETUP_PASSWORD'
  | 'GET_STATUS'
  | 'GET_WHITELIST'
  | 'ADD_DOMAIN'
  | 'REMOVE_DOMAIN'
  | 'ACTIVATE_LOCKDOWN'
  | 'DEACTIVATE_LOCKDOWN'
  | 'CHANGE_PASSWORD'
  | 'CHECK_RATE_LIMIT'
  | 'USE_RECOVERY_KEY'
  | 'EMERGENCY_DEACTIVATE';

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

export interface VerifyPasswordPayload {
  password: string;
}

export interface SetupPasswordPayload {
  password: string;
  whitelist: string[];
}

export interface AddDomainPayload {
  domain: string;
}

export interface RemoveDomainPayload {
  domain: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface UseRecoveryKeyPayload {
  recoveryKey: string;
  newPassword: string;
}

/* ─── Response Types ─── */

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface StatusData {
  setupComplete: boolean;
  lockdownActive: boolean;
  whitelistCount: number;
}

export interface RateLimitData {
  canAttempt: boolean;
  secondsRemaining: number;
}

export interface SetupResult {
  recoveryKey: string;
}

/* ─── DNR Rule Types ─── */

export interface DynamicRule {
  id: number;
  priority: number;
  action: {
    type: 'allow' | 'block' | 'redirect';
    redirect?: {
      extensionPath?: string;
    };
  };
  condition: {
    urlFilter?: string;
    requestDomains?: string[];
    resourceTypes?: chrome.declarativeNetRequest.ResourceType[];
    regexFilter?: string;
  };
}

/* ─── Constants ─── */

export const CRYPTO_CONFIG = {
  ITERATIONS: 600_000,
  HASH_ALGORITHM: 'SHA-256',
  SALT_BYTES: 16,
  KEY_LENGTH_BITS: 256,
} as const;

export const RATE_LIMIT_CONFIG = {
  COOLDOWN_MS: 60_000,
  MAX_CONSECUTIVE_FAILS: 1,
} as const;

export const STORAGE_VERSION = 1;

/**
 * Reserved rule ID ranges:
 * 1-999: Static rules (block_all.json)
 * 1000: Extension self-allow rule
 * 1001-1010: Dangerous scheme redirect rules
 * 2000+: Dynamic whitelist allow rules
 */
export const RULE_ID = {
  EXTENSION_SELF: 1000,
  BLOCK_DATA_SCHEME: 1001,
  BLOCK_BLOB_SCHEME: 1002,
  BLOCK_JAVASCRIPT_SCHEME: 1003,
  CLOUDFLARE_TURNSTILE: 1010,
  WHITELIST_START: 2000,
} as const;
