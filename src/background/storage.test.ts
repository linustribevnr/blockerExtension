/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isSetupComplete,
  markSetupComplete,
  isLockdownActive,
  setLockdownActive,
  addDomain,
  removeDomain,
  getWhitelist,
} from './storage';
import { checkRateLimit, recordFailedAttempt, clearRateLimit } from './rate-limiter';

// Mock Chrome Storage
const localStore: Record<string, any> = {};
const sessionStore: Record<string, any> = {};

const chromeMock = {
  storage: {
    local: {
      get: vi.fn().mockImplementation(async (keys: string | string[] | Record<string, any>) => {
        const result: Record<string, any> = {};
        const keyList = Array.isArray(keys) ? keys : Object.keys(keys);
        for (const k of keyList) {
          if (localStore[k] !== undefined) {
            result[k] = localStore[k];
          }
        }
        return result;
      }),
      set: vi.fn().mockImplementation(async (items: Record<string, any>) => {
        Object.assign(localStore, items);
      }),
    },
    session: {
      get: vi.fn().mockImplementation(async (keys: string | string[] | Record<string, any>) => {
        const result: Record<string, any> = {};
        const keyList = Array.isArray(keys) ? keys : Object.keys(keys);
        for (const k of keyList) {
          if (sessionStore[k] !== undefined) {
            result[k] = sessionStore[k];
          }
        }
        return result;
      }),
      set: vi.fn().mockImplementation(async (items: Record<string, any>) => {
        Object.assign(sessionStore, items);
      }),
    },
  },
};

vi.stubGlobal('chrome', chromeMock);

describe('LabLock — Storage & Rate Limiter Modules', () => {
  beforeEach(() => {
    // Clear stores before each test
    for (const key of Object.keys(localStore)) delete localStore[key];
    for (const key of Object.keys(sessionStore)) delete sessionStore[key];
    vi.clearAllMocks();
  });

  describe('Local Storage Flags', () => {
    it('should default to setup incomplete and lockdown inactive', async () => {
      const setup = await isSetupComplete();
      const active = await isLockdownActive();

      expect(setup).toBe(false);
      expect(active).toBe(false);
    });

    it('should correctly set setupComplete flag', async () => {
      await markSetupComplete();
      const setup = await isSetupComplete();
      expect(setup).toBe(true);
    });

    it('should correctly set lockdownActive flag', async () => {
      await setLockdownActive(true);
      const active = await isLockdownActive();
      expect(active).toBe(true);
    });
  });

  describe('Whitelist Storage and Normalization', () => {
    it('should normalize domains (remove protocol, path, and wildcards)', async () => {
      await addDomain('https://*.hackerrank.com/test-path?param=1');
      const whitelist = await getWhitelist();
      expect(whitelist).not.toBeNull();
      expect(whitelist![0]!.domain).toBe('hackerrank.com');
    });

    it('should prevent duplicate domains', async () => {
      await addDomain('hackerrank.com');
      await addDomain('HackerRank.com'); // casing differences
      await addDomain('https://hackerrank.com/'); // protocol/trailing slash differences

      const whitelist = await getWhitelist();
      expect(whitelist!.length).toBe(1);
    });

    it('should successfully remove a domain', async () => {
      await addDomain('hackerrank.com');
      await addDomain('google.com');

      let whitelist = await getWhitelist();
      expect(whitelist!.length).toBe(2);

      await removeDomain('hackerrank.com');
      whitelist = await getWhitelist();
      expect(whitelist!.length).toBe(1);
      expect(whitelist![0]!.domain).toBe('google.com');
    });

    it('should fail integrity check if whitelist was tampered with', async () => {
      await addDomain('hackerrank.com');

      // Tamper with localStore directly bypassing storage API
      localStore.whitelist = [{ domain: 'unauthorized-domain.com', addedAt: new Date().toISOString() }];

      const whitelist = await getWhitelist();
      expect(whitelist).toBeNull(); // Integrity verification must fail
    });
  });

  describe('Rate Limiter', () => {
    it('should allow initial attempts', async () => {
      const limit = await checkRateLimit();
      expect(limit.canAttempt).toBe(true);
      expect(limit.secondsRemaining).toBe(0);
    });

    it('should lock attempts after a failed attempt', async () => {
      await recordFailedAttempt();
      const limit = await checkRateLimit();
      expect(limit.canAttempt).toBe(false);
      expect(limit.secondsRemaining).toBeGreaterThan(0);
      expect(limit.secondsRemaining).toBeLessThanOrEqual(60);
    });

    it('should clear lock after successful verification', async () => {
      await recordFailedAttempt();
      let limit = await checkRateLimit();
      expect(limit.canAttempt).toBe(false);

      await clearRateLimit();
      limit = await checkRateLimit();
      expect(limit.canAttempt).toBe(true);
    });
  });
});
