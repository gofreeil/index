import { getStrapiMe, displayName } from '$lib/server/strapi';
import { SHARED_SSO_COOKIE } from '$lib/server/session';

/**
 * זיהוי מראש דרך העוגייה המשותפת gofreeil-auth (.gofreeil.com): מי שכבר מחובר
 * באתר אחר של יוצאים לחירות רואה "המשך כ-<שם>" בלחיצה אחת. עוגייה מתה או
 * חסרה → null, וכפתור ה-SSO מוצג כאפשרות משנית בלבד (לא כהבטחה שתיכשל).
 */
export async function load({ cookies }) {
	let ssoName = null;
	const sharedJwt = cookies.get(SHARED_SSO_COOKIE);
	if (sharedJwt) {
		try {
			const me = await getStrapiMe(sharedJwt);
			if (me?.email) ssoName = displayName(me) || 'חבר הקהילה';
		} catch {
			/* Strapi לא זמין - מציגים את הדף הרגיל */
		}
	}
	return { ssoName };
}
