/**
 * LabLock — Rate Limiter
 *
 * Enforces a 1-attempt-per-60-seconds cooldown on password verification.
 * All state is stored in chrome.storage.session (survives service worker restarts
 * but clears when the browser session ends — which is acceptable since the
 * cooldown is a short-term defense).
 *
 * CRITICAL: This runs in the service worker, NOT the UI.
 * The UI only receives "canAttempt" and "secondsRemaining" — it cannot bypass
 * the cooldown by DOM manipulation.
 */

import { RATE_LIMIT_CONFIG, type SessionStorageSchema } from '../types';

/**
 * Check whether a password attempt is currently allowed.
 *
 * @returns Object with `canAttempt` boolean and `secondsRemaining` until next attempt.
 */
export async function checkRateLimit(): Promise<{
  canAttempt: boolean;
  secondsRemaining: number;
}> {
  const data = await chrome.storage.session.get([
    'lastFailedAttempt',
    'failedAttemptCount',
  ]);

  const session = data as Partial<SessionStorageSchema>;
  const lastFailed = session.lastFailedAttempt ?? null;

  if (lastFailed === null) {
    return { canAttempt: true, secondsRemaining: 0 };
  }

  const elapsed = Date.now() - lastFailed;
  const remaining = RATE_LIMIT_CONFIG.COOLDOWN_MS - elapsed;

  if (remaining <= 0) {
    return { canAttempt: true, secondsRemaining: 0 };
  }

  return {
    canAttempt: false,
    secondsRemaining: Math.ceil(remaining / 1000),
  };
}

/**
 * Record a failed password attempt.
 * Sets the cooldown timer to prevent further attempts for 60 seconds.
 */
export async function recordFailedAttempt(): Promise<void> {
  const data = await chrome.storage.session.get(['failedAttemptCount']);
  const session = data as Partial<SessionStorageSchema>;
  const currentCount = session.failedAttemptCount ?? 0;

  await chrome.storage.session.set({
    lastFailedAttempt: Date.now(),
    failedAttemptCount: currentCount + 1,
  } satisfies Partial<SessionStorageSchema>);
}

/**
 * Clear rate limiting state after a successful authentication.
 */
export async function clearRateLimit(): Promise<void> {
  await chrome.storage.session.set({
    lastFailedAttempt: null,
    failedAttemptCount: 0,
  } satisfies Partial<SessionStorageSchema>);
}

/**
 * Get the total count of consecutive failed attempts.
 * Useful for logging/monitoring suspicious activity.
 */
export async function getFailedAttemptCount(): Promise<number> {
  const data = await chrome.storage.session.get(['failedAttemptCount']);
  const session = data as Partial<SessionStorageSchema>;
  return session.failedAttemptCount ?? 0;
}
