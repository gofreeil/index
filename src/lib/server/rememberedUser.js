// ============================================================
// rememberedUser.js — "המשתמש מחובר גם כש-Strapi לא עונה"
//
// הזהות נבדקת בכל בקשה מול Strapi (/users/me). כשהבדיקה נופלת על
// timeout או תקלת רשת, המשתמש נראה מנותק לאותה בקשה — ומפרסמת באמצע
// שליחה קיבלה "התחברו" אף שהייתה מחוברת. כלל הרשת: משתמש לא מתחבר
// יותר מפעם אחת.
//
// הפתרון: אחרי כל אימות מוצלח נשמרת עוגייה חתומה (HMAC) עם פרטי
// הזהות, קשורה לטביעת ה-JWT הנוכחי. כש-Strapi לא עונה — ורק אז —
// סומכים עליה. טוקן פסול (401) עדיין מנתק: שם העוגייה לא נקראת.
// ============================================================

import { createHmac, createHash, timingSafeEqual } from 'crypto';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

const COOKIE = 'idx-who';
const YEAR = 60 * 60 * 24 * 365;

function secret() {
	return env.STRAPI_TOKEN || '';
}

/** @param {string} jwt */
const jwtTag = (jwt) => createHash('sha256').update(jwt).digest('base64url').slice(0, 22);

/** @param {string} body */
const sign = (body) => createHmac('sha256', secret()).update(body).digest('base64url');

/**
 * @typedef {{ id: string, name: string, email: string, app_role: string | null }} LocalUser
 */

/**
 * שומר את הזהות המאומתת — רק אם השתנתה, כדי לא לצרף Set-Cookie לכל תשובה.
 * @param {import('@sveltejs/kit').Cookies} cookies @param {string} jwt @param {LocalUser} user
 */
export function rememberUser(cookies, jwt, user) {
	if (!secret()) return;
	const body = Buffer.from(
		JSON.stringify({ t: jwtTag(jwt), u: user }),
		'utf8'
	).toString('base64url');
	const value = `${body}.${sign(body)}`;
	if (cookies.get(COOKIE) === value) return;
	cookies.set(COOKIE, value, {
		path: '/',
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		maxAge: YEAR
	});
}

/**
 * הזהות האחרונה שאומתה עבור אותו JWT, או null.
 * @param {import('@sveltejs/kit').Cookies} cookies @param {string} jwt @returns {LocalUser | null}
 */
export function recallUser(cookies, jwt) {
	const raw = cookies.get(COOKIE);
	if (!raw || !secret()) return null;
	const dot = raw.lastIndexOf('.');
	if (dot < 1) return null;
	const body = raw.slice(0, dot);
	const a = Buffer.from(raw.slice(dot + 1));
	const b = Buffer.from(sign(body));
	if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
	try {
		const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
		if (data?.t !== jwtTag(jwt) || !data?.u?.email) return null;
		return data.u;
	} catch {
		return null;
	}
}

/** @param {import('@sveltejs/kit').Cookies} cookies */
export function forgetUser(cookies) {
	cookies.delete(COOKIE, { path: '/' });
}
