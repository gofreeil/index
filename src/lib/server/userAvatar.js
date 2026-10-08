// ============================================================
// userAvatar.js — תמונת הפרופיל של המשתמש המחובר, לאווטאר שבהדר
//
// המקור: avatar_url על רשומת המשתמש ב-Strapi המשותף — קישור (תמונת Google/Facebook שהקהילה
// מסנכרנת בכל כניסה) או data:image;base64 שהועלה ידנית בפרופיל הקהילה. קישור עובר לדף כמות
// שהוא; תמונה מוטבעת לא נכנסת לנתוני הדף (וגם לא לעוגיית הזהות השמורה), ולכן מוגשת
// מ-/api/me/avatar עם חותם תוכן ב-?v=. אין תמונה → ההדר מציג את האות הראשונה של השם.
// ============================================================

export const MY_AVATAR_PATH = '/api/me/avatar';

/** קישורים ארוכים מזה לא נשמרים (עוגיית הזהות השמורה מוגבלת ל-4KB) */
const MAX_URL_LENGTH = 1500;

/** @param {string} s */
function stamp(s) {
	const probe = `${s.length}:${s.slice(28, 60)}:${s.slice(-32)}`;
	let h = 0;
	for (let i = 0; i < probe.length; i++) h = (Math.imul(h, 31) + probe.charCodeAt(i)) | 0;
	return (h >>> 0).toString(36);
}

/**
 * כתובת להצגה: קישור http(s) כמו שהוא, תמונה מוטבעת → נתיב ההגשה, ואחרת ''
 * @param {string | null | undefined} raw
 */
export function avatarSrc(raw) {
	const a = (raw ?? '').trim();
	if (/^https?:\/\//i.test(a)) return a.length <= MAX_URL_LENGTH ? a : '';
	if (/^data:image\//i.test(a)) return `${MY_AVATAR_PATH}?v=${stamp(a)}`;
	return '';
}

/**
 * תשובת GET /api/me/avatar: התמונה המוטבעת של המשתמש המחובר, או 404
 * @param {string | null | undefined} raw
 */
export function myAvatarResponse(raw) {
	const m = /^data:(image\/[\w+.-]+);base64,(.*)$/s.exec(raw ?? '');
	if (!m) return new Response(null, { status: 404, headers: { 'cache-control': 'private, no-store' } });
	const buf = Buffer.from(m[2], 'base64');
	return new Response(new Uint8Array(buf), {
		headers: {
			'content-type': m[1],
			'content-length': String(buf.byteLength),
			// ?v= מתחלף עם התמונה — קאש ארוך, בדפדפן בלבד (תמונה של משתמש מחובר)
			'cache-control': 'private, max-age=31536000, immutable',
			'x-content-type-options': 'nosniff',
			'content-security-policy': "default-src 'none'; sandbox"
		}
	});
}
