/**
 * LabLock — declarativeNetRequest Rule Engine
 *
 * Compiles the whitelist into DNR dynamic rules and manages the static
 * block-all ruleset. This is the core enforcement mechanism.
 *
 * Rule architecture:
 * - Static ruleset "block_all" (priority 1): blocks ALL traffic
 * - Dynamic allow rules (priority 2): override block for whitelisted domains
 * - Dynamic redirect rules (priority 3): redirect blocked main_frame to blocked.html
 *
 * The static ruleset is toggled on/off via enableRulesetIds/disableRulesetIds.
 * Dynamic rules are managed via updateDynamicRules.
 */

import { RULE_ID, type WhitelistEntry } from '../types';

/** All resource types that should be subject to blocking */
const ALL_RESOURCE_TYPES = [
  'main_frame',
  'sub_frame',
  'stylesheet',
  'script',
  'image',
  'font',
  'object',
  'xmlhttprequest',
  'ping',
  'media',
  'websocket',
  'webtransport',
  'webbundle',
  'other',
] as chrome.declarativeNetRequest.ResourceType[];

/**
 * Enable the static block-all ruleset and compile dynamic allow rules
 * from the whitelist.
 */
export async function activateLockdown(
  whitelist: WhitelistEntry[]
): Promise<void> {
  // 1. Enable the static block-all ruleset
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: ['block_all'],
  });

  // 2. Compile and apply dynamic rules
  await compileDynamicRules(whitelist);
}

/**
 * Disable the static block-all ruleset and remove all dynamic rules.
 */
export async function deactivateLockdown(): Promise<void> {
  // 1. Disable the static block-all ruleset
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    disableRulesetIds: ['block_all'],
  });

  // 2. Remove all dynamic rules
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existingRules.map((r) => r.id);

  if (existingIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingIds,
    });
  }
}

/**
 * Compile whitelist entries into dynamic DNR rules.
 * Clears all existing dynamic rules first, then creates fresh ones.
 */
export async function compileDynamicRules(
  whitelist: WhitelistEntry[]
): Promise<void> {
  // Clear existing dynamic rules
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existingRules.map((r) => r.id);

  // Build new rule set
  const addRules: chrome.declarativeNetRequest.Rule[] = [];

  // Rule: Allow the extension's own pages (blocked.html, setup.html, etc.)
  addRules.push({
    id: RULE_ID.EXTENSION_SELF,
    priority: 10,
    action: { type: 'allow' as chrome.declarativeNetRequest.RuleActionType },
    condition: {
      urlFilter: `chrome-extension://${chrome.runtime.id}/*`,
      resourceTypes: ALL_RESOURCE_TYPES,
    },
  });

  // Rule: Redirect main_frame requests that would be blocked to blocked.html
  // This must have a higher priority than block_all (priority 1) but lower
  // than allow rules (priority 2). Using priority 1 with redirect action —
  // redirect actions take precedence over block actions at the same priority.
  // Actually, we use a different approach: we use the blocked page as a
  // URL filter negative match. The static block rule already blocks.
  // We need a redirect rule that catches main_frame navigations to show
  // a friendly blocked page instead of Chrome's ERR_BLOCKED_BY_CLIENT.
  addRules.push({
    id: RULE_ID.EXTENSION_SELF + 1,
    priority: 1,
    action: {
      type: 'redirect' as chrome.declarativeNetRequest.RuleActionType,
      redirect: {
        extensionPath: '/blocked.html',
      },
    },
    condition: {
      urlFilter: '*',
      resourceTypes: ['main_frame'] as chrome.declarativeNetRequest.ResourceType[],
      excludedRequestDomains: whitelist.map((e) => e.domain),
    },
  });

  // Whitelist allow rules (priority 2 — overrides block_all at priority 1)
  whitelist.forEach((entry, index) => {
    addRules.push({
      id: RULE_ID.WHITELIST_START + index,
      priority: 2,
      action: { type: 'allow' as chrome.declarativeNetRequest.RuleActionType },
      condition: {
        requestDomains: [entry.domain],
        resourceTypes: ALL_RESOURCE_TYPES,
      },
    });
  });

  // Apply all rules atomically
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingIds,
    addRules,
  });
}

/**
 * Verify that the current dynamic rules match the expected whitelist.
 * Used for self-healing after service worker restart.
 *
 * @returns true if rules are consistent, false if recompilation is needed.
 */
export async function verifyRulesIntegrity(
  whitelist: WhitelistEntry[]
): Promise<boolean> {
  const dynamicRules = await chrome.declarativeNetRequest.getDynamicRules();

  // Check that every whitelisted domain has a corresponding allow rule
  const allowedDomains = new Set<string>();
  for (const rule of dynamicRules) {
    if (
      rule.action.type === 'allow' &&
      rule.condition.requestDomains
    ) {
      for (const domain of rule.condition.requestDomains) {
        allowedDomains.add(domain);
      }
    }
  }

  for (const entry of whitelist) {
    if (!allowedDomains.has(entry.domain)) {
      return false;
    }
  }

  // Check that no unexpected domains are allowed
  const expectedDomains = new Set(whitelist.map((e) => e.domain));
  for (const domain of allowedDomains) {
    if (!expectedDomains.has(domain)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if the static block-all ruleset is currently enabled.
 */
export async function isBlockAllEnabled(): Promise<boolean> {
  const rulesets = await chrome.declarativeNetRequest.getEnabledRulesets();
  return rulesets.includes('block_all');
}
