import { useEffect, useState } from 'react';

/**
 * Blocked Page — shown when a student navigates to a non-whitelisted domain.
 *
 * Reads the attempted URL from query params.
 * Completely self-contained — no external resource loading.
 * No interactive elements — no forms, no links to bypass.
 */
export default function Blocked() {
  const [attemptedUrl, setAttemptedUrl] = useState<string>('');
  const [reason, setReason] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('url');
    const reasonParam = params.get('reason');

    if (url) {
      try {
        setAttemptedUrl(decodeURIComponent(url));
      } catch {
        setAttemptedUrl(url);
      }
    }

    setReason(reasonParam ?? 'blocked');
  }, []);

  return (
    <div className="blocked-page">
      <div className="container container--narrow animate-in">
        <div className="blocked-icon">🔒</div>
        <h1>Access Restricted</h1>
        <p className="mt-4">
          {reason === 'restricted'
            ? 'This page has been blocked by your system administrator.'
            : 'This site is not on the approved whitelist.'}
        </p>
        {attemptedUrl && (
          <div className="blocked-url">{attemptedUrl}</div>
        )}
        <p className="mt-6 text-sm text-muted">
          LabLock is enforcing site restrictions for this session.
          Contact your lab administrator if you believe this is an error.
        </p>
      </div>
    </div>
  );
}
