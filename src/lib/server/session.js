import { dev } from '$app/environment';
import { forgetUser } from './rememberedUser.js';
import { sharedCookieOptions } from './recovery';

// עוגיית ה-session של אתר האינדקס (host-only). httpOnly → לא נגישה ל-JS בדפדפן,
// מונעת דליפת JWT דרך XSS (בניגוד ל-localStorage הישן). קוראים גם את העוגייה
// המשותפת gofreeil-auth (SSO מהקהילה) ב-hooks כ-fallback.
export const SESSION_COOKIE = 'idx-auth';
export const SHARED_SSO_COOKIE = 'gofreeil-auth';

const YEAR = 60 * 60 * 24 * 365;

/**
 * נרשם/התחבר פעם אחת → מזוהה בכל אתרי הרשת באותו מכשיר: לצד סשן האינדקס
 * נכתבת גם העוגייה המשותפת gofreeil-auth על .gofreeil.com, שכל אתר ברשת קורא.
 * @param {import('@sveltejs/kit').Cookies} cookies @param {string} jwt @param {URL} url
 */
export function setSession(cookies, jwt, url) {
	cookies.set(SESSION_COOKIE, jwt, {
		path: '/',
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		maxAge: YEAR
	});
	setSharedSession(cookies, jwt, url);
}

/** @param {import('@sveltejs/kit').Cookies} cookies @param {string} jwt @param {URL} url */
export function setSharedSession(cookies, jwt, url) {
	cookies.set(SHARED_SSO_COOKIE, jwt, sharedCookieOptions(url));
	cookies.set(SHARED_MARK_COOKIE, '1', {
		path: '/',
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		maxAge: YEAR
	});
}

/**
 * סימון "הסשן הזה כבר שותף עם הרשת". כשהעוגייה המשותפת נעלמת והסימון קיים —
 * המשתמש התנתק באתר אחר ברשת, ומנתקים גם כאן (ולא מחזירים אותה בכוח).
 */
export const SHARED_MARK_COOKIE = 'idx-shared';

/** @param {import('@sveltejs/kit').Cookies} cookies */
export function clearSession(cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/' });
	cookies.delete(SHARED_MARK_COOKIE, { path: '/' });
	forgetUser(cookies);
	// חובה למחוק גם את עוגיית ה-SSO המשותפת — hooks מאמת דרכה כ-fallback,
	// ובלעדי זה המשתמש "מתחבר מחדש" מיד אחרי התנתקות. היא נכתבת על הדומיין
	// ההורה (.gofreeil.com), ומחיקה תופסת רק עם אותו domain; מוחקים גם host-only ליתר ביטחון.
	cookies.delete(SHARED_SSO_COOKIE, { path: '/' });
	if (!dev) cookies.delete(SHARED_SSO_COOKIE, { path: '/', domain: '.gofreeil.com' });
}
