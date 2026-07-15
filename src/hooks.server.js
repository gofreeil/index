import { getStrapiMe, displayName } from '$lib/server/strapi';
import { SESSION_COOKIE, SHARED_SSO_COOKIE } from '$lib/server/session';

// מאכלס את event.locals.user מתוך ה-JWT ב-cookie (idx-auth, או gofreeil-auth המשותף).
// הזהות מאומתת מול Strapi (/users/me) — לא נסמכים על תוכן ה-cookie בלבד.
export async function handle({ event, resolve }) {
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
