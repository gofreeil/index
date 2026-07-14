import { dev } from '$app/environment';

// עוגיית ה-session של אתר האינדקס (host-only). httpOnly → לא נגישה ל-JS בדפדפן,
// מונעת דליפת JWT דרך XSS (בניגוד ל-localStorage הישן). קוראים גם את העוגייה
// המשותפת gofreeil-auth (SSO מהקהילה) ב-hooks כ-fallback.
export const SESSION_COOKIE = 'idx-auth';
export const SHARED_SSO_COOKIE = 'gofreeil-auth';

const YEAR = 60 * 60 * 24 * 365;

/** @param {import('@sveltejs/kit').Cookies} cookies @param {string} jwt */
export function setSession(cookies, jwt) {
	cookies.set(SESSION_COOKIE, jwt, {
		path: '/',
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		maxAge: YEAR
	});
}

/** @param {import('@sveltejs/kit').Cookies} cookies */
export function clearSession(cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}
