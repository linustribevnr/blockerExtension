/**
 * LabLock — Chrome Runtime Messaging Utilities
 *
 * Type-safe wrappers around chrome.runtime.sendMessage.
 * All UI components use these instead of calling chrome APIs directly.
 */

import type {
  ExtensionMessage,
  MessageResponse,
  MessageType,
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

/**
 * Send a typed message to the service worker and await a typed response.
 */
async function sendMessage<T = unknown>(
  type: MessageType,
  payload?: unknown
): Promise<MessageResponse<T>> {
  const message: ExtensionMessage = { type, payload };
  return chrome.runtime.sendMessage(message) as Promise<MessageResponse<T>>;
}

/* ─── Public API ─── */

export async function getStatus(): Promise<MessageResponse<StatusData>> {
  return sendMessage<StatusData>('GET_STATUS');
}

export async function checkRateLimit(): Promise<
  MessageResponse<RateLimitData>
> {
  return sendMessage<RateLimitData>('CHECK_RATE_LIMIT');
}

export async function setupPassword(
  password: string,
  whitelist: string[]
): Promise<MessageResponse<SetupResult>> {
  const payload: SetupPasswordPayload = { password, whitelist };
  return sendMessage<SetupResult>('SETUP_PASSWORD', payload);
}

export async function verifyPassword(
  password: string
): Promise<MessageResponse> {
  const payload: VerifyPasswordPayload = { password };
  return sendMessage('VERIFY_PASSWORD', payload);
}

export async function getWhitelist(): Promise<
  MessageResponse<{ domains: string[] }>
> {
  return sendMessage<{ domains: string[] }>('GET_WHITELIST');
}

export async function addDomainToWhitelist(
  domain: string
): Promise<MessageResponse<{ domains: string[] }>> {
  const payload: AddDomainPayload = { domain };
  return sendMessage<{ domains: string[] }>('ADD_DOMAIN', payload);
}

export async function removeDomainFromWhitelist(
  domain: string
): Promise<MessageResponse<{ domains: string[] }>> {
  const payload: RemoveDomainPayload = { domain };
  return sendMessage<{ domains: string[] }>('REMOVE_DOMAIN', payload);
}

export async function activateLockdown(): Promise<MessageResponse> {
  return sendMessage('ACTIVATE_LOCKDOWN');
}

export async function deactivateLockdown(
  password: string
): Promise<MessageResponse> {
  const payload: VerifyPasswordPayload = { password };
  return sendMessage('DEACTIVATE_LOCKDOWN', payload);
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<MessageResponse> {
  const payload: ChangePasswordPayload = { currentPassword, newPassword };
  return sendMessage('CHANGE_PASSWORD', payload);
}

export async function submitRecoveryKey(
  recoveryKey: string,
  newPassword: string
): Promise<MessageResponse> {
  const payload: UseRecoveryKeyPayload = { recoveryKey, newPassword };
  return sendMessage('USE_RECOVERY_KEY', payload);
}

export async function emergencyDeactivate(
  password: string
): Promise<MessageResponse> {
  const payload: VerifyPasswordPayload = { password };
  return sendMessage('EMERGENCY_DEACTIVATE', payload);
}
