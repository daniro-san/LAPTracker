// The analytics question on public pages (D115): the visitor's answer, kept on this device only after they
// answer (local storage, our own key). Nothing is stored before. `granted`: PostHog may use its cookie and
// local storage, and public pages are recorded in PUBLIC_REPLAY_SAMPLE of page loads (D77). `denied`, or no
// answer: cookieless, nothing stored by PostHog, no replay. Browser storage can throw (private windows,
// blocked site data): then there is no answer and the page stays cookieless.
export type Consent = "granted" | "denied";

export const CONSENT_KEY = "lap_analytics";
/** The footer's "Analytics choices" asks again through this window event. */
export const ASK_CONSENT_EVENT = "lap:analytics-choices";

export function storedConsent(): Consent | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function storeConsent(consent: Consent): void {
  try {
    localStorage.setItem(CONSENT_KEY, consent);
  } catch {
    // Not kept: the question comes back on the next page load.
  }
}
