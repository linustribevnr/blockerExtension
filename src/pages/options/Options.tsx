import { useState, useEffect, useCallback } from 'react';
import {
  verifyPassword,
  checkRateLimit,
  getStatus,
  getWhitelist,
  addDomainToWhitelist,
  removeDomainFromWhitelist,
  deactivateLockdown,
  changePassword,
  submitRecoveryKey,
  activateLockdown,
} from '../../utils/messaging';

type View = 'auth' | 'recovery' | 'dashboard';

/**
 * Options Page — Admin control panel behind a password gate.
 *
 * The password verification and rate limiting are enforced in the service worker.
 * This UI only reflects the state — it cannot bypass the cooldown.
 */
export default function Options() {
  const [view, setView] = useState<View>('auth');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Rate limiting state
  const [canAttempt, setCanAttempt] = useState(true);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  // Dashboard state
  const [domains, setDomains] = useState<string[]>([]);
  const [lockdownActive, setLockdownActiveState] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [dashboardError, setDashboardError] = useState('');
  const [dashboardSuccess, setDashboardSuccess] = useState('');

  // Password change
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmNewPw, setConfirmNewPw] = useState('');

  // Recovery key
  const [recoveryKeyInput, setRecoveryKeyInput] = useState('');
  const [newPwRecovery, setNewPwRecovery] = useState('');

  // Deactivation
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [deactivatePassword, setDeactivatePassword] = useState('');

  // Check rate limit on mount and poll countdown
  useEffect(() => {
    const updateRateLimit = async () => {
      const result = await checkRateLimit();
      if (result.success && result.data) {
        setCanAttempt(result.data.canAttempt);
        setSecondsRemaining(result.data.secondsRemaining);
      }
    };

    updateRateLimit();
    const interval = setInterval(updateRateLimit, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboard = useCallback(async () => {
    const [statusResult, whitelistResult] = await Promise.all([
      getStatus(),
      getWhitelist(),
    ]);

    if (statusResult.success && statusResult.data) {
      setLockdownActiveState(statusResult.data.lockdownActive);
    }

    if (whitelistResult.success && whitelistResult.data) {
      setDomains(whitelistResult.data.domains);
    }
  }, []);

  const handleLogin = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await verifyPassword(password);

      if (!result.success) {
        setError(result.error ?? 'Authentication failed');
        setPassword('');
        // Refresh rate limit state
        const rl = await checkRateLimit();
        if (rl.success && rl.data) {
          setCanAttempt(rl.data.canAttempt);
          setSecondsRemaining(rl.data.secondsRemaining);
        }
        return;
      }

      // Authenticated — load dashboard data
      await loadDashboard();
      setView('dashboard');
    } catch {
      setError('Authentication failed');
    } finally {
      setLoading(false);
    }
  }, [password, loadDashboard]);

  const handleAddDomain = useCallback(async () => {
    const trimmed = domainInput.trim();
    if (!trimmed) return;

    setDashboardError('');
    setDashboardSuccess('');

    const result = await addDomainToWhitelist(trimmed);

    if (!result.success) {
      setDashboardError(result.error ?? 'Failed to add domain');
      return;
    }

    if (result.data) {
      setDomains(result.data.domains);
    }
    setDomainInput('');
    setDashboardSuccess(`Added ${trimmed}`);
    setTimeout(() => setDashboardSuccess(''), 3000);
  }, [domainInput]);

  const handleRemoveDomain = useCallback(async (domain: string) => {
    setDashboardError('');

    const result = await removeDomainFromWhitelist(domain);

    if (!result.success) {
      setDashboardError(result.error ?? 'Failed to remove domain');
      return;
    }

    if (result.data) {
      setDomains(result.data.domains);
    }
  }, []);

  const handleChangePassword = useCallback(async () => {
    setDashboardError('');

    if (newPw !== confirmNewPw) {
      setDashboardError('New passwords do not match');
      return;
    }

    if (newPw.length < 8) {
      setDashboardError('New password must be at least 8 characters');
      return;
    }

    const result = await changePassword(currentPw, newPw);

    if (!result.success) {
      setDashboardError(result.error ?? 'Failed to change password');
      return;
    }

    setShowPasswordChange(false);
    setCurrentPw('');
    setNewPw('');
    setConfirmNewPw('');
    setDashboardSuccess('Password changed successfully');
    setTimeout(() => setDashboardSuccess(''), 3000);
  }, [currentPw, newPw, confirmNewPw]);

  const handleDeactivate = useCallback(async () => {
    setDashboardError('');

    const result = await deactivateLockdown(deactivatePassword);

    if (!result.success) {
      setDashboardError(result.error ?? 'Failed to deactivate');
      return;
    }

    setShowDeactivate(false);
    setDeactivatePassword('');
    setLockdownActiveState(false);
    setDashboardSuccess('Lockdown deactivated');
    setTimeout(() => setDashboardSuccess(''), 3000);
  }, [deactivatePassword]);

  const handleReactivate = useCallback(async () => {
    setDashboardError('');

    if (domains.length === 0) {
      setDashboardError('Add at least one domain before activating');
      return;
    }

    const result = await activateLockdown();

    if (!result.success) {
      setDashboardError(result.error ?? 'Failed to activate');
      return;
    }

    setLockdownActiveState(true);
    setDashboardSuccess('Lockdown re-activated');
    setTimeout(() => setDashboardSuccess(''), 3000);
  }, [domains]);

  const handleRecovery = useCallback(async () => {
    setError('');
    setLoading(true);

    try {
      if (newPwRecovery.length < 8) {
        setError('New password must be at least 8 characters');
        return;
      }

      const result = await submitRecoveryKey(recoveryKeyInput, newPwRecovery);

      if (!result.success) {
        setError(result.error ?? 'Recovery failed');
        const rl = await checkRateLimit();
        if (rl.success && rl.data) {
          setCanAttempt(rl.data.canAttempt);
          setSecondsRemaining(rl.data.secondsRemaining);
        }
        return;
      }

      // Recovery successful — go to dashboard
      await loadDashboard();
      setView('dashboard');
    } catch {
      setError('Recovery failed');
    } finally {
      setLoading(false);
    }
  }, [recoveryKeyInput, newPwRecovery, loadDashboard]);

  /* ─── Auth View ─── */
  if (view === 'auth') {
    return (
      <div className="setup-page">
        <main id="main-content" className="container container--narrow">
          <div className="animate-in text-center">
            <h2>🔒 LabLock Admin</h2>
            <p className="mt-2">Enter your master password to access settings.</p>

            {error && <div className="alert alert--error mt-4">{error}</div>}

            {!canAttempt && (
              <div className="countdown mt-4">
                <div className="countdown-number">{secondsRemaining}</div>
                <div className="countdown-label">seconds until next attempt</div>
              </div>
            )}

            <div className="form-group mt-6">
              <input
                id="auth-password"
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Master password"
                disabled={!canAttempt}
                onKeyDown={(e) =>
                  e.key === 'Enter' && canAttempt && handleLogin()
                }
                autoFocus
              />
            </div>

            <button
              className="btn btn--primary btn--full"
              onClick={handleLogin}
              disabled={!canAttempt || loading || !password}
            >
              {loading ? 'Verifying...' : 'Unlock'}
            </button>

            <button
              className="btn btn--ghost btn--full mt-4"
              onClick={() => setView('recovery')}
            >
              Use Recovery Key
            </button>
          </div>
        </main>
      </div>
    );
  }

  /* ─── Recovery View ─── */
  if (view === 'recovery') {
    return (
      <div className="setup-page">
        <main id="main-content" className="container container--narrow">
          <div className="animate-in">
            <h2>Account Recovery</h2>
            <p className="mt-2">
              Enter your recovery key and set a new master password.
            </p>

            {error && <div className="alert alert--error mt-4">{error}</div>}

            {!canAttempt && (
              <div className="countdown mt-4">
                <div className="countdown-number">{secondsRemaining}</div>
                <div className="countdown-label">seconds until next attempt</div>
              </div>
            )}

            <div className="form-group mt-6">
              <label className="form-label" htmlFor="recovery-key">
                Recovery Key
              </label>
              <input
                id="recovery-key"
                type="text"
                className="form-input form-input--mono"
                value={recoveryKeyInput}
                onChange={(e) => setRecoveryKeyInput(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-..."
                disabled={!canAttempt}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="new-pw-recovery">
                New Master Password
              </label>
              <input
                id="new-pw-recovery"
                type="password"
                className="form-input"
                value={newPwRecovery}
                onChange={(e) => setNewPwRecovery(e.target.value)}
                placeholder="Minimum 8 characters"
                disabled={!canAttempt}
              />
            </div>

            <button
              className="btn btn--primary btn--full"
              onClick={handleRecovery}
              disabled={
                !canAttempt ||
                loading ||
                !recoveryKeyInput ||
                newPwRecovery.length < 8
              }
            >
              {loading ? 'Recovering...' : 'Reset Password'}
            </button>

            <button
              className="btn btn--ghost btn--full mt-4"
              onClick={() => {
                setView('auth');
                setError('');
              }}
            >
              Back to Login
            </button>
          </div>
        </main>
      </div>
    );
  }

  /* ─── Dashboard View ─── */
  return (
    <div className="setup-page">
      <main id="main-content" className="container">
        <div className="animate-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1>LabLock Admin</h1>
            <span
              className={`badge ${lockdownActive ? 'badge--active' : 'badge--inactive'}`}
            >
              {lockdownActive ? '🔒 ACTIVE' : '🔓 INACTIVE'}
            </span>
          </div>

          {dashboardError && (
            <div className="alert alert--error mt-4">{dashboardError}</div>
          )}
          {dashboardSuccess && (
            <div className="alert alert--success mt-4">{dashboardSuccess}</div>
          )}

          {/* Whitelist Management */}
          <div className="card mt-6">
            <h3>Whitelisted Domains</h3>
            <p className="text-sm mt-2">
              Domains listed here (and their subdomains) are accessible.
            </p>

            <div className="form-group mt-4">
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <input
                  id="dashboard-domain"
                  type="text"
                  className="form-input form-input--mono"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="e.g. hackerrank.com"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                />
                <button className="btn btn--primary" onClick={handleAddDomain}>
                  Add
                </button>
              </div>
            </div>

            {domains.length > 0 ? (
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
            ) : (
              <p className="text-sm text-muted mt-4">No domains whitelisted.</p>
            )}
          </div>

          {/* Lockdown Controls */}
          <div className="card mt-4">
            <h3>Lockdown Control</h3>

            {lockdownActive ? (
              <>
                <p className="text-sm mt-2">
                  Lockdown is active. All non-whitelisted traffic is blocked.
                </p>
                {!showDeactivate ? (
                  <button
                    className="btn btn--danger btn--full mt-4"
                    onClick={() => setShowDeactivate(true)}
                  >
                    Deactivate Lockdown
                  </button>
                ) : (
                  <div className="mt-4">
                    <div className="form-group">
                      <label className="form-label" htmlFor="deactivate-pw">
                        Confirm Password to Deactivate
                      </label>
                      <input
                        id="deactivate-pw"
                        type="password"
                        className="form-input"
                        value={deactivatePassword}
                        onChange={(e) => setDeactivatePassword(e.target.value)}
                        placeholder="Master password"
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <button
                        className="btn btn--danger"
                        onClick={handleDeactivate}
                        disabled={!deactivatePassword}
                      >
                        Confirm Deactivation
                      </button>
                      <button
                        className="btn btn--ghost"
                        onClick={() => {
                          setShowDeactivate(false);
                          setDeactivatePassword('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-sm mt-2">
                  Lockdown is not active. Click below to re-activate.
                </p>
                <button
                  className="btn btn--primary btn--full mt-4"
                  onClick={handleReactivate}
                  disabled={domains.length === 0}
                >
                  🔒 Activate Lockdown
                </button>
              </>
            )}
          </div>

          {/* Password Change */}
          <div className="card mt-4">
            <h3>Change Password</h3>

            {!showPasswordChange ? (
              <button
                className="btn btn--ghost btn--full mt-4"
                onClick={() => setShowPasswordChange(true)}
              >
                Change Master Password
              </button>
            ) : (
              <div className="mt-4">
                <div className="form-group">
                  <label className="form-label" htmlFor="current-pw">
                    Current Password
                  </label>
                  <input
                    id="current-pw"
                    type="password"
                    className="form-input"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-pw">
                    New Password
                  </label>
                  <input
                    id="new-pw"
                    type="password"
                    className="form-input"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="Minimum 8 characters"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="confirm-new-pw">
                    Confirm New Password
                  </label>
                  <input
                    id="confirm-new-pw"
                    type="password"
                    className="form-input"
                    value={confirmNewPw}
                    onChange={(e) => setConfirmNewPw(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    className="btn btn--primary"
                    onClick={handleChangePassword}
                    disabled={!currentPw || newPw.length < 8 || !confirmNewPw}
                  >
                    Update Password
                  </button>
                  <button
                    className="btn btn--ghost"
                    onClick={() => {
                      setShowPasswordChange(false);
                      setCurrentPw('');
                      setNewPw('');
                      setConfirmNewPw('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
