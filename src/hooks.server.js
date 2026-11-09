import { verifyStrapiJwt, displayName } from '$lib/server/strapi';
import { rememberUser, recallUser } from '$lib/server/rememberedUser.js';
import { getSiteProfile } from '$lib/server/profileStore';
import { SESSION_COOKIE, SHARED_SSO_COOKIE } from '$lib/server/session';
import { avatarSrc } from '$lib/server/userAvatar.js';

// נתיב תמונות הפרסומות — ציבורי לחלוטין ולא תלוי-משתמש. חייב לעקוף את
// שרשרת הזיהוי: כל נגיעה בסשן עלולה לצרף Set-Cookie לתשובה, ו-Vercel
// לעולם לא שומר בקאש הקצה תשובה שנושאת עוגייה. בלי העקיפה ה-CDN מחזיר
// MISS בכל בקשה, התמונה יוצאת מה-origin מחדש בכל פעם, וכל התועלת של
// ה-cache-control הארוך ב-/api/ad-image הולכת לאיבוד (נמדד באתר הקהילה).
// בונוס: חוסך גם את ה-round-trip ל-Strapi (/users/me) על כל תמונה.
const PUBLIC_IMAGE_PATH = /^\/api\/ad-image\/[^/]+\/[^/]+$/;

// נתיבי סריקה של בוטים (וורדפרס/PHP/קבצי סודות) — לאתר הזה אין אף אחד מהם. בלי הקיצור כל
// ניסיון כזה מרנדר את דף ה-404 המלא (כולל ה-layout) ועולה זמן CPU; עונים בשורה אחת, ו-s-maxage
// נותן ל-CDN של Vercel לזכור את התשובה כך שחזרה על אותו נתיב לא מגיעה לפונקציה.
const JUNK_PATH =
	/\.(?:php\d*|aspx?|jsp|cgi)$|^\/(?:wp-[^/]*|wordpress|phpmyadmin|cgi-bin|\.env[^/]*|\.git|\.aws|\.ssh)(?:\/|$)/i;

// מאכלס את event.locals.user מתוך ה-JWT ב-cookie (idx-auth, או gofreeil-auth המשותף).
// הזהות מאומתת מול Strapi (/users/me) — לא נסמכים על תוכן ה-cookie בלבד.
export async function handle({ event, resolve }) {
	if (event.request.method === 'GET' && JUNK_PATH.test(event.url.pathname)) {
		return new Response('Not found', {
			status: 404,
			headers: {
				'content-type': 'text/plain; charset=utf-8',
				'cache-control': 'public, s-maxage=86400'
			}
		});
	}

	if (PUBLIC_IMAGE_PATH.test(event.url.pathname)) {
		event.locals.user = null;
		return resolve(event);
	}

	event.locals.user = null;
	const jwt = event.cookies.get(SESSION_COOKIE) || event.cookies.get(SHARED_SSO_COOKIE);
	if (jwt) {
		const r = await verifyStrapiJwt(jwt);
		const me = 'me' in r ? r.me : null;
		if ('transient' in r) {
			// Strapi לא ענה — לא מנתקים משתמש מחובר; הזהות האחרונה שאומתה
			event.locals.user = recallUser(event.cookies, jwt);
		} else if (me?.email) {
			// שם התצוגה: הדריסה המקומית ("רק באתר הזה") קודמת לשם המשותף של
			// הרשת. נשענת על המטמון של configStore — לא סבב Strapi נוסף.
			const local = await getSiteProfile(me.id).catch(() => null);
			event.locals.user = {
				id: String(me.id),
				name: local?.name || displayName(me),
				email: me.email,
				app_role: me.app_role || null,
				// תמונת הפרופיל לאווטאר בהדר ('' = אין → האות הראשונה)
				avatar: avatarSrc(me.avatar_url)
			};
			rememberUser(event.cookies, jwt, event.locals.user);
		}
	}
	return resolve(event);
}
