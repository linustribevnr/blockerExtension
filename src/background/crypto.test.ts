import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, generateRecoveryKey, sha256 } from './crypto';

describe('LabLock — Crypto Module', () => {
  describe('Password Hashing and Verification', () => {
    it('should correctly hash and verify a password', async () => {
      const dummyPlaintextVal = 'aBcd_1234_Efgh_5678';
      const hashData = await hashPassword(dummyPlaintextVal);

      expect(hashData.hash).toBeDefined();
      expect(hashData.salt).toBeDefined();
      expect(hashData.iterations).toBe(600000);
      expect(hashData.hash.length).toBe(64); // SHA-256 output is 64 hex characters (32 bytes)
      expect(hashData.salt.length).toBe(32); // 16-byte salt is 32 hex characters

      const isValid = await verifyPassword(dummyPlaintextVal, hashData);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const dummyPlaintextVal = 'aBcd_1234_Efgh_5678';
      const incorrectPlaintextVal = 'xyz_9876_wuv_5432';
      const hashData = await hashPassword(dummyPlaintextVal);

      const isValid = await verifyPassword(incorrectPlaintextVal, hashData);
      expect(isValid).toBe(false);
    });

    it('should generate unique salts for identical passwords', async () => {
      const duplicatePlaintextVal = 'foo_bar_baz_qux';
      const hashData1 = await hashPassword(duplicatePlaintextVal);
      const hashData2 = await hashPassword(duplicatePlaintextVal);

      expect(hashData1.salt).not.toBe(hashData2.salt);
      expect(hashData1.hash).not.toBe(hashData2.hash);
    });
  });

  describe('Recovery Key Generation', () => {
    it('should generate valid recovery keys', () => {
      const key = generateRecoveryKey();
      // Format: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
      // Since it's a 16-byte random hex formatted in groups of 4 characters:
      // 16 bytes = 32 hex characters. 32 characters / 4 = 8 groups.
      // So 8 groups of 4 characters separated by 7 hyphens.
      // Length = 8 * 4 + 7 = 39 characters.
      expect(key).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){7}$/);
    });

    it('should generate unique recovery keys each time', () => {
      const key1 = generateRecoveryKey();
      const key2 = generateRecoveryKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('SHA-256 Utility', () => {
    it('should compute correct sha256 hash', async () => {
      const data = 'lablock-whitelist';
      const hash = await sha256(data);
      expect(hash).toBe('2dd7316d551820012010a44f176ea7c5b7674b68d9ae863d15a6dc1d7fcd25b2');
    });
  });
});
