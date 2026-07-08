import { getStrapiMe } from '$lib/server/strapi';

/**
 * חזרה מ-SSO של "יוצאים לחירות" (community.gofreeil.com/sso).
 * קהילה קבעה את העוגייה המשותפת gofreeil-auth (httpOnly) על .gofreeil.com,
 * המכילה JWT של ה-Strapi המשותף. קוראים אותה בצד-שרת, מאמתים מול /api/users/me
 * ומחזירים את פרטי המשתמש; הלקוח שומר אותם ב-authUser (localStorage).
 */
export async function load({ cookies, url }) {
	const raw = url.searchParams.get('returnTo') || '/';
	const returnTo = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';

	if (url.searchParams.get('error')) {
		return { status: 'not_registered', returnTo, user: null };
	}

	const jwt = cookies.get('gofreeil-auth');
	if (!jwt) {
		return { status: 'not_registered', returnTo, user: null };
	}

	const me = await getStrapiMe(jwt);
	if (!me?.email) {
		return { status: 'not_registered', returnTo, user: null };
	}

	return {
		status: 'ok',
		returnTo,
		user: { id: String(me.id), name: me.username || me.email, email: me.email }
	};
}
