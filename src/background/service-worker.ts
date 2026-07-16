/**
 * LabLock — Service Worker (Background Script)
 *
 * The brain of the extension. Handles:
 * - First-run detection and setup redirect
 * - Message routing from popup/options/setup pages
 * - Password verification with rate limiting
 * - Tab interception for anti-bypass
 * - Self-healing rule verification on startup
 * - Navigation interception for dangerous URI schemes
 *
 * SECURITY: All sensitive operations (crypto, rate limiting, rule management)
 * execute here — never in the UI layer.
 */

import { hashPassword, verifyPassword, generateRecoveryKey } from './crypto';
import { checkRateLimit, recordFailedAttempt, clearRateLimit } from './rate-limiter';
import {
  isSetupComplete,
  markSetupComplete,
  isLockdownActive,
  setLockdownActive,
  storePasswordData,
  getPasswordData,
  storeRecoveryKeyData,
  getRecoveryKeyData,
  getWhitelist,
  getWhitelistRaw,
  setWhitelist,
  addDomain,
  removeDomain,
} from './storage';
import {
  activateLockdown,
  deactivateLockdown,
  compileDynamicRules,
  verifyRulesIntegrity,
  isBlockAllEnabled,
} from './rule-engine';
import type {
  ExtensionMessage,
  MessageResponse,
  VerifyPasswordPayload,
  SetupPasswordPayload,
  AddDomainPayload,
  RemoveDomainPayload,
  ChangePasswordPayload,
  UseRecoveryKeyPayload,
  StatusData,
  RateLimitData,
  SetupResult,
} from '../types';

/* ─── Blocked Chrome Pages ─── */

const BLOCKED_CHROME_URLS = [
  'chrome://extensions',
  'chrome://flags',
  'chrome://settings',
  'chrome://apps',
  'chrome://bookmarks',
  'chrome://downloads',
  'chrome://history',
  'chrome://inspect',
  'chrome://net-internals',
  'chrome://policy',
  'about:blank',
];

const BLOCKED_SCHEMES = ['data:', 'blob:', 'javascript:', 'view-source:'];

/* ─── Extension Lifecycle ─── */

/**
 * On install or update: check if setup is needed, verify rule integrity.
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // First install — open setup wizard
    await chrome.tabs.create({
      url: chrome.runtime.getURL('setup.html'),
    });
  } else if (details.reason === 'update') {
    // Extension updated — verify rules are still intact
    await selfHealRules();
  }
});

/**
 * On browser startup: verify rules and re-lockdown if necessary.
 */
chrome.runtime.onStartup.addListener(async () => {
  await selfHealRules();
});

/**
 * Self-healing: verify that DNR rules match the stored whitelist.
 * If rules have been tampered with or lost, recompile them.
 */
async function selfHealRules(): Promise<void> {
  const setupDone = await isSetupComplete();
  const lockdownOn = await isLockdownActive();

  if (!setupDone || !lockdownOn) return;

  const whitelist = await getWhitelist();

  if (whitelist === null) {
    // Integrity check failed — whitelist was tampered with
    // Re-read raw whitelist and recompile (best-effort recovery)
    const rawWhitelist = await getWhitelistRaw();
    await activateLockdown(rawWhitelist);
    return;
  }

  const rulesValid = await verifyRulesIntegrity(whitelist);
  const blockAllOn = await isBlockAllEnabled();

  if (!rulesValid || !blockAllOn) {
    // Rules are out of sync — recompile
    await activateLockdown(whitelist);
  }
}

/* ─── Message Router ─── */

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((err: Error) => {
        sendResponse({
          success: false,
          error: err.message || 'Internal error',
        });
      });

    // Return true to indicate async response
    return true;
  }
);

async function handleMessage(
  message: ExtensionMessage
): Promise<MessageResponse> {
  switch (message.type) {
    case 'GET_STATUS':
      return handleGetStatus();

    case 'CHECK_RATE_LIMIT':
      return handleCheckRateLimit();

    case 'SETUP_PASSWORD':
      return handleSetupPassword(message.payload as SetupPasswordPayload);

    case 'VERIFY_PASSWORD':
      return handleVerifyPassword(message.payload as VerifyPasswordPayload);

    case 'GET_WHITELIST':
      return handleGetWhitelist();

    case 'ADD_DOMAIN':
      return handleAddDomain(message.payload as AddDomainPayload);

    case 'REMOVE_DOMAIN':
      return handleRemoveDomain(message.payload as RemoveDomainPayload);

    case 'ACTIVATE_LOCKDOWN':
      return handleActivateLockdown();

    case 'DEACTIVATE_LOCKDOWN':
      return handleDeactivateLockdown(
        message.payload as VerifyPasswordPayload
      );

    case 'CHANGE_PASSWORD':
      return handleChangePassword(message.payload as ChangePasswordPayload);

    case 'USE_RECOVERY_KEY':
      return handleUseRecoveryKey(message.payload as UseRecoveryKeyPayload);

    case 'EMERGENCY_DEACTIVATE':
      return handleEmergencyDeactivate(
        message.payload as VerifyPasswordPayload
      );

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

/* ─── Message Handlers ─── */

async function handleGetStatus(): Promise<MessageResponse<StatusData>> {
  const setupDone = await isSetupComplete();
  const lockdownOn = await isLockdownActive();
  const whitelist = await getWhitelistRaw();

  return {
    success: true,
    data: {
      setupComplete: setupDone,
      lockdownActive: lockdownOn,
      whitelistCount: whitelist.length,
    },
  };
}

async function handleCheckRateLimit(): Promise<MessageResponse<RateLimitData>> {
  const result = await checkRateLimit();
  return { success: true, data: result };
}

async function handleSetupPassword(
  payload: SetupPasswordPayload
): Promise<MessageResponse<SetupResult>> {
  // Prevent re-setup if already complete
  const setupDone = await isSetupComplete();
  if (setupDone) {
    return { success: false, error: 'Setup already completed' };
  }

  // Validate password strength (minimum 8 characters)
  if (!payload.password || payload.password.length < 8) {
    return {
      success: false,
      error: 'Password must be at least 8 characters',
    };
  }

  // Hash the master password
  const passwordData = await hashPassword(payload.password);
  await storePasswordData(passwordData);

  // Generate and store recovery key
  const recoveryKey = generateRecoveryKey();
  const recoveryKeyData = await hashPassword(recoveryKey);
  await storeRecoveryKeyData(recoveryKeyData);

  // Store initial whitelist
  if (payload.whitelist && payload.whitelist.length > 0) {
    await setWhitelist(payload.whitelist);
  }

  // Mark setup as complete
  await markSetupComplete();

  return {
    success: true,
    data: { recoveryKey },
  };
}

async function handleVerifyPassword(
  payload: VerifyPasswordPayload
): Promise<MessageResponse> {
  // Check rate limit FIRST
  const rateCheck = await checkRateLimit();
  if (!rateCheck.canAttempt) {
    return {
      success: false,
      error: `Too many attempts. Try again in ${rateCheck.secondsRemaining} seconds.`,
    };
  }

  const passwordData = await getPasswordData();
  if (!passwordData.hash) {
    return { success: false, error: 'No password configured' };
  }

  const isValid = await verifyPassword(payload.password, passwordData);

  if (!isValid) {
    await recordFailedAttempt();
    return { success: false, error: 'Incorrect password' };
  }

  // Success — clear rate limiting
  await clearRateLimit();
  return { success: true };
}

async function handleGetWhitelist(): Promise<
  MessageResponse<{ domains: string[] }>
> {
  const whitelist = await getWhitelistRaw();
  return {
    success: true,
    data: { domains: whitelist.map((e) => e.domain) },
  };
}

async function handleAddDomain(
  payload: AddDomainPayload
): Promise<MessageResponse<{ domains: string[] }>> {
  if (!payload.domain || payload.domain.trim().length === 0) {
    return { success: false, error: 'Domain cannot be empty' };
  }

  const updated = await addDomain(payload.domain);

  // Recompile rules if lockdown is active
  const lockdownOn = await isLockdownActive();
  if (lockdownOn) {
    await compileDynamicRules(updated);
  }

  return {
    success: true,
    data: { domains: updated.map((e) => e.domain) },
  };
}

async function handleRemoveDomain(
  payload: RemoveDomainPayload
): Promise<MessageResponse<{ domains: string[] }>> {
  const updated = await removeDomain(payload.domain);

  // Recompile rules if lockdown is active
  const lockdownOn = await isLockdownActive();
  if (lockdownOn) {
    await compileDynamicRules(updated);
  }

  return {
    success: true,
    data: { domains: updated.map((e) => e.domain) },
  };
}

async function handleActivateLockdown(): Promise<MessageResponse> {
  const whitelist = await getWhitelistRaw();

  if (whitelist.length === 0) {
    return {
      success: false,
      error: 'Cannot activate lockdown with empty whitelist',
    };
  }

  await activateLockdown(whitelist);
  await setLockdownActive(true);

  return { success: true };
}

async function handleDeactivateLockdown(
  payload: VerifyPasswordPayload
): Promise<MessageResponse> {
  // Require password to deactivate
  const passwordData = await getPasswordData();
  const isValid = await verifyPassword(payload.password, passwordData);

  if (!isValid) {
    await recordFailedAttempt();
    return { success: false, error: 'Incorrect password' };
  }

  await deactivateLockdown();
  await setLockdownActive(false);
  await clearRateLimit();

  return { success: true };
}

async function handleChangePassword(
  payload: ChangePasswordPayload
): Promise<MessageResponse> {
  // Verify current password
  const passwordData = await getPasswordData();
  const isValid = await verifyPassword(payload.currentPassword, passwordData);

  if (!isValid) {
    await recordFailedAttempt();
    return { success: false, error: 'Current password is incorrect' };
  }

  if (payload.newPassword.length < 8) {
    return {
      success: false,
      error: 'New password must be at least 8 characters',
    };
  }

  // Hash and store new password
  const newPasswordData = await hashPassword(payload.newPassword);
  await storePasswordData(newPasswordData);
  await clearRateLimit();

  return { success: true };
}

async function handleUseRecoveryKey(
  payload: UseRecoveryKeyPayload
): Promise<MessageResponse> {
  const rateCheck = await checkRateLimit();
  if (!rateCheck.canAttempt) {
    return {
      success: false,
      error: `Too many attempts. Try again in ${rateCheck.secondsRemaining} seconds.`,
    };
  }

  const recoveryData = await getRecoveryKeyData();
  if (!recoveryData) {
    return { success: false, error: 'No recovery key configured' };
  }

  const isValid = await verifyPassword(payload.recoveryKey, recoveryData);

  if (!isValid) {
    await recordFailedAttempt();
    return { success: false, error: 'Invalid recovery key' };
  }

  if (payload.newPassword.length < 8) {
    return {
      success: false,
      error: 'New password must be at least 8 characters',
    };
  }

  // Set new password and invalidate recovery key
  const newPasswordData = await hashPassword(payload.newPassword);
  await storePasswordData(newPasswordData);
  await storeRecoveryKeyData(null as unknown as import('../types').RecoveryKeyData);
  await clearRateLimit();

  return { success: true };
}

async function handleEmergencyDeactivate(
  payload: VerifyPasswordPayload
): Promise<MessageResponse> {
  // Emergency deactivation requires password
  const passwordData = await getPasswordData();
  const isValid = await verifyPassword(payload.password, passwordData);

  if (!isValid) {
    await recordFailedAttempt();
    return { success: false, error: 'Incorrect password' };
  }

  await deactivateLockdown();
  await setLockdownActive(false);
  await clearRateLimit();

  return { success: true };
}

/* ─── Anti-Bypass: Tab Monitoring ─── */

/**
 * Monitor tab URL changes. If a tab navigates to a blocked chrome:// URL
 * or uses a dangerous URI scheme, redirect it to blocked.html.
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (!changeInfo.url) return;

  const lockdownOn = await isLockdownActive();
  if (!lockdownOn) return;

  const url = changeInfo.url;

  // Block chrome:// pages (except the extension's own pages)
  if (isBlockedChromeUrl(url)) {
    await redirectToBlocked(tabId, url);
    return;
  }

  // Block dangerous URI schemes
  if (isBlockedScheme(url)) {
    await redirectToBlocked(tabId, url);
    return;
  }
});

/**
 * Monitor new tab creation.
 */
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!tab.pendingUrl && !tab.url) return;

  const lockdownOn = await isLockdownActive();
  if (!lockdownOn) return;

  const url = tab.pendingUrl ?? tab.url ?? '';

  if (isBlockedChromeUrl(url) || isBlockedScheme(url)) {
    await redirectToBlocked(tab.id!, url);
  }
});

/* ─── Anti-Bypass: Navigation Interception ─── */

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Only intercept top-level navigations
  if (details.frameId !== 0) return;

  const lockdownOn = await isLockdownActive();
  if (!lockdownOn) return;

  const url = details.url;

  if (isBlockedChromeUrl(url) || isBlockedScheme(url)) {
    await redirectToBlocked(details.tabId, url);
  }
});

/* ─── Anti-Bypass: Incognito Check ─── */

chrome.runtime.onInstalled.addListener(async () => {
  const isAllowed = await chrome.extension.isAllowedIncognitoAccess();
  if (!isAllowed) {
    // Warn admin that extension needs incognito access
    await chrome.tabs.create({
      url: chrome.runtime.getURL(
        'setup.html#incognito-warning'
      ),
    });
  }
});

/* ─── Helper Functions ─── */

function isBlockedChromeUrl(url: string): boolean {
  const lower = url.toLowerCase();

  // Allow extension's own pages
  if (lower.startsWith(`chrome-extension://${chrome.runtime.id}`)) {
    return false;
  }

  // Block all chrome:// URLs
  if (lower.startsWith('chrome://') || lower.startsWith('chrome-untrusted://')) {
    return BLOCKED_CHROME_URLS.some((blocked) =>
      lower.startsWith(blocked)
    );
  }

  // Block about:blank
  if (lower === 'about:blank') {
    return true;
  }

  return false;
}

function isBlockedScheme(url: string): boolean {
  const lower = url.toLowerCase();
  return BLOCKED_SCHEMES.some((scheme) => lower.startsWith(scheme));
}

async function redirectToBlocked(tabId: number, attemptedUrl: string): Promise<void> {
  const encodedUrl = encodeURIComponent(attemptedUrl);
  const blockedUrl = chrome.runtime.getURL(
    `blocked.html?url=${encodedUrl}&reason=restricted`
  );

  try {
    await chrome.tabs.update(tabId, { url: blockedUrl });
  } catch {
    // Tab may have been closed already — ignore
  }
}
