import { useEffect, useState, useCallback } from 'react';
import { getStatus } from '../../utils/messaging';
import type { StatusData } from '../../types';

/**
 * Popup — Quick status indicator.
 *
 * Shows lockdown status and whitelisted domain count.
 * Minimal surface area — no sensitive controls here.
 * Links to Options page for admin management.
 */
export default function Popup() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    try {
      const result = await getStatus();
      if (result.success && result.data) {
        setStatus(result.data);
      }
    } catch {
      // Extension may not be fully initialized
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const openOptions = useCallback(() => {
    chrome.runtime.openOptionsPage();
  }, []);

  const openSetup = useCallback(() => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('setup.html'),
    });
  }, []);

  if (loading) {
    return (
      <main id="main-content" className="popup">
        <div className="text-center text-muted">Loading...</div>
      </main>
    );
  }

  if (!status) {
    return (
      <main id="main-content" className="popup">
        <div className="alert alert--error">Failed to load extension status.</div>
      </main>
    );
  }

  return (
    <main id="main-content" className="popup">
      <div className="popup-header">
        <span className="popup-title">LabLock</span>
        <span
          className={`badge ${
            status.lockdownActive ? 'badge--active' : 'badge--inactive'
          }`}
        >
          {status.lockdownActive ? 'ACTIVE' : 'INACTIVE'}
        </span>
      </div>

      {!status.setupComplete ? (
        <>
          <div className="alert alert--warning">
            Extension not configured. Run the setup wizard.
          </div>
          <button className="btn btn--primary btn--full mt-4" onClick={openSetup}>
            Open Setup
          </button>
        </>
      ) : (
        <>
          <div className="popup-stat">
            <span className="popup-stat-label">Status</span>
            <span className="popup-stat-value">
              {status.lockdownActive ? '🔒 Enforcing' : '🔓 Not enforcing'}
            </span>
          </div>
          <div className="popup-stat">
            <span className="popup-stat-label">Whitelisted Domains</span>
            <span className="popup-stat-value">{status.whitelistCount}</span>
          </div>

          <button
            className="btn btn--ghost btn--full mt-4"
            onClick={openOptions}
          >
            Open Admin Panel
          </button>
        </>
      )}

      <p
        className="text-center mt-4"
        style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}
      >
        LabLock v1.0.0
      </p>
    </main>
  );
}
