import { getStrapiMe, displayName } from '$lib/server/strapi';
import { SESSION_COOKIE, SHARED_SSO_COOKIE } from '$lib/server/session';

// נתיב תמונות הפרסומות — ציבורי לחלוטין ולא תלוי-משתמש. חייב לעקוף את
// שרשרת הזיהוי: כל נגיעה בסשן עלולה לצרף Set-Cookie לתשובה, ו-Vercel
// לעולם לא שומר בקאש הקצה תשובה שנושאת עוגייה. בלי העקיפה ה-CDN מחזיר
// MISS בכל בקשה, התמונה יוצאת מה-origin מחדש בכל פעם, וכל התועלת של
// ה-cache-control הארוך ב-/api/ad-image הולכת לאיבוד (נמדד באתר הקהילה).
// בונוס: חוסך גם את ה-round-trip ל-Strapi (/users/me) על כל תמונה.
const PUBLIC_IMAGE_PATH = /^\/api\/ad-image\/[^/]+\/[^/]+$/;

// מאכלס את event.locals.user מתוך ה-JWT ב-cookie (idx-auth, או gofreeil-auth המשותף).
// הזהות מאומתת מול Strapi (/users/me) — לא נסמכים על תוכן ה-cookie בלבד.
export async function handle({ event, resolve }) {
	if (PUBLIC_IMAGE_PATH.test(event.url.pathname)) {
		event.locals.user = null;
		return resolve(event);
	}

	event.locals.user = null;
	const jwt = event.cookies.get(SESSION_COOKIE) || event.cookies.get(SHARED_SSO_COOKIE);
	if (jwt) {
		const me = await getStrapiMe(jwt);
		if (me?.email) {
			event.locals.user = {
				id: String(me.id),
				name: displayName(me),
				email: me.email,
				app_role: me.app_role || null
			};
		}
	}
	return resolve(event);
}
