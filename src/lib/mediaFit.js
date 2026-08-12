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

/**
 * קורא את השדה המוסתר של הטופס ומחזיר את מה ששווה לשמור. ברירות מחדל
 * מושמטות, ורשימת תמונות שכולה ברירת מחדל לא נשמרת כלל.
 * @param {unknown} raw
 * @returns {{logo?: Fit, banners?: Fit[]} | null}
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

	/** @type {{logo?: Fit, banners?: Fit[]}} */
	const out = {};
	const logo = parseFit(obj.logo);
	if (!isDefaultFit(logo)) out.logo = logo;

	const banners = parseFitList(obj.banners);
	if (banners.some((f) => !isDefaultFit(f))) out.banners = banners;

	return Object.keys(out).length ? out : null;
}
