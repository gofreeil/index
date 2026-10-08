import { verifyStrapiJwt } from '$lib/server/strapi';
import { SESSION_COOKIE, SHARED_SSO_COOKIE } from '$lib/server/session';
import { myAvatarResponse } from '$lib/server/userAvatar.js';

/** GET /api/me/avatar — תמונת פרופיל שהועלתה ידנית של המשתמש המחובר (ראה userAvatar.js) */
export async function GET({ cookies }) {
	const jwt = cookies.get(SESSION_COOKIE) || cookies.get(SHARED_SSO_COOKIE);
	const r = jwt ? await verifyStrapiJwt(jwt) : null;
	const me = r && 'me' in r ? r.me : null;
	return myAvatarResponse(me?.avatar_url);
}
