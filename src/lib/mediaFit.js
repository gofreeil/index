// ============================================================
// מיקום וזום של הלוגו והתמונות של הכרטיסייה
//
// אותה סמנטיקה של הסטודיו בפרסומות ושל אריחי הקטגוריות: לכל תמונה
// { x, y, z } — נקודת מיקוד באחוזים וזום יחסית למילוי המשבצת. הציור עצמו
// נעשה באותה פעולה אחת (adImgFit), כדי שמה שרואים בעורך יהיה בדיוק מה
// שיוצג בכרטיסייה ובאריח שבדף הבית.
//
// הערכים נשמרים ב-extra_fields.media_fit — לתמונות ב-Strapi אין שדה
// למיקום, ומפתח לא מוכר היה נבלע בשקט (ראו branches.js, socialLinks.js).
// ברירת מחדל לא נשמרת בכלל: כרטיסייה שלא נגעו בה נשארת עם json ריק,
// והתצוגה ממשיכה להשתמש ב-CSS המקורי בלי שהפעולה תיגע בה.
// ============================================================

import { parseAdImageFit, DEFAULT_AD_FIT } from './adImageFit';

export const DEFAULT_FIT = DEFAULT_AD_FIT;

/** @typedef {{x: number, y: number, z: number}} Fit */

/** @param {unknown} raw @returns {Fit} */
export function parseFit(raw) {
	const { x, y, z } = parseAdImageFit(raw);
	return { x, y, z };
}

/** @param {unknown} raw @returns {Fit[]} */
export function parseFitList(raw) {
	return Array.isArray(raw) ? raw.slice(0, 8).map(parseFit) : [];
}

/** תמונה שלא מוקמה — אין טעם לשמור אותה ואין טעם לצייר אותה מחדש.
 * @param {Fit | null | undefined} f */
export const isDefaultFit = (f) =>
	!f || (f.x === DEFAULT_FIT.x && f.y === DEFAULT_FIT.y && f.z === DEFAULT_FIT.z);

/* ── מסגרת הלוגו ──────────────────────────────────────────────
   לוגו עגול או ריבוע מעוגל, לבחירת בעל העסק. ברירת המחדל היא הריבוע
   המעוגל — המראה שכל הכרטיסיות הקיימות כבר מציגות. */

/** @typedef {'square' | 'circle'} LogoShape */

/** @type {LogoShape} */
export const DEFAULT_LOGO_SHAPE = 'square';

/** @param {unknown} raw @returns {LogoShape} */
export function parseLogoShape(raw) {
	return raw === 'circle' ? 'circle' : DEFAULT_LOGO_SHAPE;
}

/** ה-class של המסגרת — מקור אחד לכרטיסייה ולעורך, שלא ייפרדו.
 * @param {unknown} raw */
export const logoShapeClass = (raw) =>
	parseLogoShape(raw) === 'circle' ? 'rounded-full' : 'rounded-xl';

/* ── התמונה הראשית ────────────────────────────────────────────
   התמונה שמייצגת את העסק: היא הבאנר של האריח בדף הבית, היא שנפתחת
   ראשונה בגלריה שבכרטיסייה, והיא שנשלחת לרשתות בשיתוף. עד היום זו
   הייתה תמיד התמונה הראשונה שהועלתה, בלי שלבעל העסק תהיה בכך בחירה.
   נשמר כאינדקס ולא ככתובת: העלאה חדשה מחליפה את כל התמונות, וכתובת
   שמורה הייתה הופכת לשבורה. */

/** @param {unknown} raw @param {number} [count] כמה תמונות יש בפועל */
export function parseMainIndex(raw, count) {
	const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : 0;
	if (n < 0) return 0;
	if (typeof count === 'number' && n >= count) return 0;
	return n;
}

/**
 * קורא את השדה המוסתר של הטופס ומחזיר את מה ששווה לשמור. ברירות מחדל
 * מושמטות, ורשימת תמונות שכולה ברירת מחדל לא נשמרת כלל.
 * @param {unknown} raw
 * @returns {{logo?: Fit, banners?: Fit[], logo_shape?: LogoShape, main?: number} | null}
 */
export function parseMediaFit(raw) {
	/** @type {any} */
	let obj = raw;
	if (typeof raw === 'string') {
		try {
			obj = JSON.parse(raw || '{}');
		} catch {
			return null;
		}
	}
	if (!obj || typeof obj !== 'object') return null;

	/** @type {{logo?: Fit, banners?: Fit[], logo_shape?: LogoShape, main?: number}} */
	const out = {};
	const logo = parseFit(obj.logo);
	if (!isDefaultFit(logo)) out.logo = logo;

	const banners = parseFitList(obj.banners);
	if (banners.some((f) => !isDefaultFit(f))) out.banners = banners;

	// מסגרת הלוגו נשמרת רק כשהיא לא ברירת המחדל, כמו המיקום והזום
	const shape = parseLogoShape(obj.logo_shape);
	if (shape !== DEFAULT_LOGO_SHAPE) out.logo_shape = shape;

	// התמונה הראשונה היא ברירת המחדל, ואין טעם לשמור אותה
	const main = parseMainIndex(obj.main);
	if (main > 0) out.main = main;

	return Object.keys(out).length ? out : null;
}
