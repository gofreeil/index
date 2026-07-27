// ============================================================
// discountCodes.js — קודי הנחה לדף הפרסום (פורט מ-community, ללא Strapi).
// עצמאי לגמרי: ברירות-מחדל מוטמעות + מבצע ההשקה (פרסום חינם עם הקוד "יוצאים לחירות").
// המרה מ-TS ל-JS עם JSDoc.
// ============================================================

/** @typedef {'percent' | 'free'} DiscountKind */

/**
 * @typedef {Object} DiscountCode
 * @property {string} id
 * @property {string} label
 * @property {string} code
 * @property {DiscountKind} kind
 * @property {number} percent
 * @property {boolean} requiresCoordinator
 * @property {boolean} active
 * @property {string} [note]
 */

/** @type {DiscountCode[]} */
export const DEFAULT_DISCOUNT_CODES = [
	{
		id: 'coordinator',
		label: 'הנחת רכז',
		code: 'רכז יוצאים לחירות',
		kind: 'percent',
		percent: 10,
		requiresCoordinator: true,
		active: true,
		note: 'תקף רק למשתמש שמאושר כרכז במערכת.'
	},
	{
		id: 'owner',
		label: 'הנחת בעלים',
		code: 'הנחת בעלים',
		kind: 'percent',
		percent: 20,
		requiresCoordinator: false,
		active: true,
		note: 'חל לפי הזנת המילים בלבד.'
	},
	{
		id: 'free',
		label: 'פטור מלא',
		code: "לה' הארץ ומלואה",
		kind: 'free',
		percent: 100,
		requiresCoordinator: false,
		active: true,
		note: 'פטור מלא מתשלום - הפרסום עולה ללא עלות.'
	}
];

// ---- מבצע השקה: פרסום חינם עם קוד בשדה ההנחה ----
// כבוי לצמיתות: קוד הבעלים עבר לאימות בצד השרת בלבד
// (ADS_OWNER_CODE, ראו $lib/server/adsCode.js) — קוד שנבדק בצד
// הלקוח מופיע בהכרח בקוד המקור הציבורי ולכן אינו סודי.
export const FREE_PROMO = false;

/** ריק — הקוד לא נמצא יותר בקוד הלקוח */
export const FREE_PROMO_CODE_TEXT = '';

/** @type {DiscountCode} */
export const FREE_PROMO_DISCOUNT = {
	id: 'free-promo',
	label: 'מבצע השקה - הפרסום חינם',
	code: FREE_PROMO_CODE_TEXT,
	kind: 'free',
	percent: 100,
	requiresCoordinator: false,
	active: false,
	note: 'קוד מבצע ההשקה.'
};

/**
 * נרמול טקסט להשוואה: הסרת גרשיים/אפוסטרופים, איחוד רווחים, lowercase.
 * @param {string} s
 * @returns {string}
 */
export function normalizeCode(s) {
	return (s ?? '')
		.replace(/[׳'`’]/g, '') // גרש / אפוסטרופים
		.replace(/["״]/g, '') // גרשיים
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase();
}

/**
 * @typedef {Object} DiscountResult
 * @property {DiscountCode | null} matched
 * @property {boolean} applied
 * @property {'' | 'no-match' | 'inactive' | 'not-coordinator'} reason
 */

/**
 * מציאת הקוד והערכת זכאות לפי הטקסט שהוזן + סטטוס רכז של המשתמש.
 * @param {string} input
 * @param {DiscountCode[]} codes
 * @param {boolean} isCoordinator
 * @returns {DiscountResult}
 */
export function evaluateDiscount(input, codes, isCoordinator) {
	const norm = normalizeCode(input);
	if (!norm) return { matched: null, applied: false, reason: 'no-match' };

	const matched = (codes ?? []).find((c) => normalizeCode(c.code) === norm) ?? null;
	if (!matched) return { matched: null, applied: false, reason: 'no-match' };
	if (!matched.active) return { matched, applied: false, reason: 'inactive' };
	if (matched.requiresCoordinator && !isCoordinator)
		return { matched, applied: false, reason: 'not-coordinator' };

	return { matched, applied: true, reason: '' };
}

/**
 * סכום ההנחה בשקלים לפי הסכום הכולל.
 * @param {number} total
 * @param {DiscountCode} matched
 * @returns {number}
 */
export function discountAmount(total, matched) {
	if (matched.kind === 'free') return total;
	return Math.round(total * (matched.percent / 100));
}
