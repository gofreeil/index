// ============================================================
// categoryStore.js — שמירת דריסות הקטגוריות של הסופר-אדמין.
//
// יושב מעל configStore (פריט ה-KV ב-Strapi) תחת המפתח category_settings,
// כדי לא לדרוש שינוי סכמה. המבנה מתועד ב-$lib/categories.js (CategorySettings):
//   order      מפתחות בסדר התצוגה של מסילת דף הבית (ריק = מיון לפי כמות)
//   overrides  שם/אימוג'י/תמונה לקטגוריות המובנות, לפי התווית הקנונית
//   extras     קטגוריות שנוספו מהמסך (מזהה x_..., שם, aliases לשמות קודמים)
//
// הסניטציה כאן היא ההגנה היחידה על הצורה — ה-KV חוזר מהרשת ויכול להכיל
// כל דבר; כל מה שלא עומד בצורה פשוט נשמט, והאתר ממשיך עם ברירות המחדל.
// ============================================================

import { getConfigValue, setConfigValue } from './configStore.js';
import { effectiveCategories } from '$lib/categories.js';

const KEY = 'category_settings';

/** @param {unknown} v @param {number} max */
const cleanStr = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * @param {any} raw
 * @returns {import('$lib/categories.js').CategorySettings}
 */
function sanitize(raw) {
	const s = raw && typeof raw === 'object' ? raw : {};

	const order = Array.isArray(s.order)
		? s.order.map((/** @type {unknown} */ k) => cleanStr(k, 80)).filter(Boolean)
		: [];

	/** @type {Record<string, import('$lib/categories.js').CategoryOverride>} */
	const overrides = {};
	if (s.overrides && typeof s.overrides === 'object' && !Array.isArray(s.overrides)) {
		for (const [label, v] of Object.entries(s.overrides)) {
			if (!v || typeof v !== 'object') continue;
			const anyV = /** @type {any} */ (v);
			/** @type {import('$lib/categories.js').CategoryOverride} */
			const o = {};
			const name = cleanStr(anyV.name, 40);
			const icon = cleanStr(anyV.icon, 16);
			const image = cleanStr(anyV.image, 500);
			if (name) o.name = name;
			if (icon) o.icon = icon;
			if (image) o.image = image;
			if (Object.keys(o).length) overrides[label] = o;
		}
	}

	/** @type {import('$lib/categories.js').CategoryExtra[]} */
	const extras = [];
	if (Array.isArray(s.extras)) {
		for (const x of s.extras) {
			if (!x || typeof x !== 'object') continue;
			const key = cleanStr(x.key, 40);
			const name = cleanStr(x.name, 40);
			if (!key || !name) continue;
			const icon = cleanStr(x.icon, 16);
			const image = cleanStr(x.image, 500);
			const aliases = Array.isArray(x.aliases)
				? [
						...new Set(
							x.aliases
								.map((/** @type {unknown} */ a) => cleanStr(a, 40))
								.filter((/** @type {string} */ a) => a && a !== name)
						)
					]
				: [];
			extras.push({ key, name, ...(icon ? { icon } : {}), ...(image ? { image } : {}), aliases });
		}
	}

	return { order, overrides, extras };
}

/**
 * ההגדרות הנוכחיות (מסונטזות). נכשל בשקט — בלי KV האתר רץ על ברירות המחדל.
 * @returns {Promise<import('$lib/categories.js').CategorySettings>}
 */
export async function getCategorySettings() {
	const raw = await getConfigValue(KEY).catch(() => undefined);
	return sanitize(raw);
}

/**
 * שמירת הגדרות (דורס את המפתח כולו — המסך תמיד שולח מצב שלם).
 * @param {import('$lib/categories.js').CategorySettings} settings
 */
export async function saveCategorySettings(settings) {
	await setConfigValue(KEY, sanitize(settings));
}

/**
 * אופציות תפריט הקטגוריות לטפסים (הגשה ועריכה): label הוא שם התצוגה
 * הנוכחי; value הוא מה שנשמר במאגר — התווית הקנונית לקטגוריה מובנית
 * (יציב גם אחרי שינוי שם), או השם הנוכחי לקטגוריה שנוספה מהמסך.
 * @returns {Promise<Array<{ value: string, label: string }>>}
 */
export async function getCategoryOptions() {
	const settings = await getCategorySettings();
	return effectiveCategories(settings).map((c) => ({
		value: c.builtin ? c.key : c.name,
		label: c.name
	}));
}
