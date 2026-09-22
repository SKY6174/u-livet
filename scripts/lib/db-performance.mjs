// A signed-out home request intentionally redirects to the login entry screen.
// Other redirects (including protection pages) must still fail the probe.
export function isExpectedLoginRedirect(label, requestUrl, status, location) {
  if (label !== '/' || ![307, 308].includes(status) || !location) return false;
  try {
    const request = new URL(requestUrl);
    const target = new URL(location, request);
    return target.origin === request.origin && target.pathname === '/auth/login'
      && !target.username && !target.password;
  } catch {
    return false;
  }
}
