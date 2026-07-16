import { useState, useCallback } from 'react';
import { setupPassword, activateLockdown } from '../../utils/messaging';

type Step = 'welcome' | 'password' | 'whitelist' | 'recovery' | 'activate' | 'done';

/**
 * Setup Wizard — first-run experience for the lab administrator.
 *
 * Flow: Welcome → Create Password → Add Domains → Show Recovery Key → Activate Lockdown
 *
 * Security:
 * - Cannot be re-opened after setup unless admin authenticates
 * - Recovery key shown exactly once — must be saved offline
 * - Minimum 8-character password enforced
 */
export default function Setup() {
  const [step, setStep] = useState<Step>('welcome');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [domains, setDomains] = useState<string[]>([]);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordStrength = getPasswordStrength(password);

  const handlePasswordSubmit = useCallback(async () => {
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setStep('whitelist');
  }, [password, confirmPassword]);

  const handleAddDomain = useCallback(() => {
    const trimmed = domainInput.trim().toLowerCase();
    if (!trimmed) return;

    if (domains.includes(trimmed)) {
      setError('Domain already added');
      return;
    }

    // Basic domain validation
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/.test(trimmed)) {
      setError('Invalid domain format. Example: hackerrank.com');
      return;
    }

    setDomains((prev) => [...prev, trimmed]);
    setDomainInput('');
    setError('');
  }, [domainInput, domains]);

  const handleRemoveDomain = useCallback((domain: string) => {
    setDomains((prev) => prev.filter((d) => d !== domain));
  }, []);

  const handleSetupComplete = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await setupPassword(password, domains);

      if (!result.success) {
        setError(result.error ?? 'Setup failed');
        setLoading(false);
        return;
      }

      setRecoveryKey(result.data?.recoveryKey ?? '');
      setStep('recovery');
    } catch {
      setError('Failed to complete setup. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [password, domains]);

  const handleActivateLockdown = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await activateLockdown();

      if (!result.success) {
        setError(result.error ?? 'Failed to activate lockdown');
        setLoading(false);
        return;
      }

      setStep('done');
    } catch {
      setError('Failed to activate lockdown.');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="setup-page">
      <div className="container container--narrow">
        {/* Progress Steps */}
        <div className="setup-steps">
          {(['welcome', 'password', 'whitelist', 'recovery', 'activate'] as Step[]).map(
            (s, i) => (
              <div
                key={s}
                className={`setup-step ${
                  step === s
                    ? 'setup-step--active'
                    : getStepIndex(step) > i
                      ? 'setup-step--done'
                      : ''
                }`}
              />
            )
          )}
        </div>

        {/* Step: Welcome */}
        {step === 'welcome' && (
          <div className="animate-in">
            <h1>🔒 LabLock Setup</h1>
            <p className="mt-4">
              Welcome to LabLock. This wizard will configure the extension to restrict
              browser access to approved websites only.
            </p>
            <p className="mt-4">
              Once activated, students will only be able to visit whitelisted domains.
              All other sites will be blocked.
            </p>
            <div className="alert alert--warning mt-6">
              ⚠️ Make sure you are the lab administrator before proceeding.
              This action cannot be undone without the master password.
            </div>
            <button
              className="btn btn--primary btn--full mt-6"
              onClick={() => setStep('password')}
            >
              Begin Setup
            </button>
          </div>
        )}

        {/* Step: Create Password */}
        {step === 'password' && (
          <div className="animate-in">
            <h2>Create Master Password</h2>
            <p className="mt-2">
              This password protects all extension settings. Choose a strong,
              memorable password.
            </p>

            {error && <div className="alert alert--error mt-4">{error}</div>}

            <div className="form-group mt-6">
              <label className="form-label" htmlFor="password">
                Master Password
              </label>
              <input
                id="password"
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                autoFocus
              />
              {password.length > 0 && (
                <div className="strength-meter">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`strength-bar ${
                        i < passwordStrength.level
                          ? `strength-bar--${passwordStrength.label}`
                          : ''
                      }`}
                    />
                  ))}
                </div>
              )}
              {password.length > 0 && (
                <div className="form-hint">
                  Strength: {passwordStrength.label}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirm-password">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              />
            </div>

            <button
              className="btn btn--primary btn--full"
              onClick={handlePasswordSubmit}
              disabled={password.length < 8 || !confirmPassword}
            >
              Continue
            </button>
          </div>
        )}

        {/* Step: Whitelist */}
        {step === 'whitelist' && (
          <div className="animate-in">
            <h2>Configure Whitelist</h2>
            <p className="mt-2">
              Add the domains students should be allowed to access during the contest.
              All subdomains are automatically included.
            </p>

            {error && <div className="alert alert--error mt-4">{error}</div>}

            <div className="form-group mt-6">
              <label className="form-label" htmlFor="domain-input">
                Add Domain
              </label>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <input
                  id="domain-input"
                  type="text"
                  className="form-input form-input--mono"
                  value={domainInput}
                  onChange={(e) => {
                    setDomainInput(e.target.value);
                    setError('');
                  }}
                  placeholder="e.g. hackerrank.com"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                  autoFocus
                />
                <button className="btn btn--primary" onClick={handleAddDomain}>
                  Add
                </button>
              </div>
              <div className="form-hint">
                Enter domain without protocol. Subdomains are auto-included.
              </div>
            </div>

            {domains.length > 0 && (
              <ul className="domain-list">
                {domains.map((domain) => (
                  <li key={domain} className="domain-item">
                    <span className="domain-name">{domain}</span>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => handleRemoveDomain(domain)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {domains.length === 0 && (
              <div className="alert alert--warning mt-4">
                Add at least one domain before continuing.
              </div>
            )}

            <button
              className="btn btn--primary btn--full mt-6"
              onClick={handleSetupComplete}
              disabled={domains.length === 0 || loading}
            >
              {loading ? 'Setting up...' : 'Save & Generate Recovery Key'}
            </button>
          </div>
        )}

        {/* Step: Recovery Key */}
        {step === 'recovery' && (
          <div className="animate-in">
            <h2>⚠️ Save Your Recovery Key</h2>
            <p className="mt-2">
              This recovery key can be used to reset your master password if you
              forget it. <strong>It will only be shown once.</strong>
            </p>

            <div className="recovery-key mt-6">{recoveryKey}</div>

            <div className="alert alert--warning mt-4">
              Write this key down or print it. Store it in a secure location.
              Once you leave this page, it cannot be recovered.
            </div>

            <button
              className="btn btn--primary btn--full mt-6"
              onClick={() => setStep('activate')}
            >
              I Have Saved My Recovery Key
            </button>
          </div>
        )}

        {/* Step: Activate Lockdown */}
        {step === 'activate' && (
          <div className="animate-in">
            <h2>Activate Lockdown</h2>
            <p className="mt-2">
              Review your configuration before activating:
            </p>

            <div className="card mt-6">
              <div className="popup-stat">
                <span className="popup-stat-label">Whitelisted Domains</span>
                <span className="popup-stat-value">{domains.length}</span>
              </div>
              {domains.map((d) => (
                <div key={d} className="popup-stat">
                  <span className="domain-name text-sm">{d}</span>
                </div>
              ))}
            </div>

            {error && <div className="alert alert--error mt-4">{error}</div>}

            <div className="alert alert--warning mt-6">
              Once activated, all non-whitelisted sites will be blocked immediately.
              You will need the master password to make changes.
            </div>

            <button
              className="btn btn--danger btn--full mt-4"
              onClick={handleActivateLockdown}
              disabled={loading}
            >
              {loading ? 'Activating...' : '🔒 Activate Lockdown'}
            </button>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="animate-in text-center">
            <div style={{ fontSize: '4rem' }}>✅</div>
            <h2 className="mt-4">Lockdown Active</h2>
            <p className="mt-2">
              LabLock is now enforcing site restrictions. Only whitelisted domains
              are accessible.
            </p>
            <p className="mt-4 text-sm text-muted">
              You can close this tab. Use the extension popup or options page to
              manage settings (master password required).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Helpers ─── */

function getStepIndex(step: Step): number {
  const steps: Step[] = ['welcome', 'password', 'whitelist', 'recovery', 'activate', 'done'];
  return steps.indexOf(step);
}

function getPasswordStrength(password: string): {
  level: number;
  label: string;
} {
  if (password.length === 0) return { level: 0, label: '' };
  if (password.length < 8) return { level: 1, label: 'weak' };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { level: 1, label: 'weak' };
  if (score === 3) return { level: 2, label: 'fair' };
  if (score === 4) return { level: 3, label: 'good' };
  return { level: 4, label: 'strong' };
}
