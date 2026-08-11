// ============================================================
// categoryStore.js — שמירת דריסות הקטגוריות של הסופר-אדמין.
//
// יושב מעל configStore (פריט ה-KV ב-Strapi) תחת המפתח category_settings,
// כדי לא לדרוש שינוי סכמה. המבנה מתועד ב-$lib/categories.js (CategorySettings):
//   order      מפתחות בסדר התצוגה של מסילת דף הבית (ריק = מיון לפי כמות)
//   overrides  שם/אימוג'י/תמונה לקטגוריות המובנות, לפי התווית הקנונית
//   extras     קטגוריות שנוספו מהמסך (מזהה x_..., שם, aliases לשמות קודמים)
//   hidden     מובנות שנמחקו מהמסך — מוסתרות מהאתר, מהטפסים ומהסיווג
//
// הסניטציה כאן היא ההגנה היחידה על הצורה — ה-KV חוזר מהרשת ויכול להכיל
// כל דבר; כל מה שלא עומד בצורה פשוט נשמט, והאתר ממשיך עם ברירות המחדל.
// ============================================================

import { getConfigValue, setConfigValueStrict } from './configStore.js';
import {
	OTHER,
	effectiveCategories,
	normCategoryLabel,
	resolveCategory,
	retiredLabelSet,
	sanitizeCategoryFit,
	isDefaultCategoryFit
} from '$lib/categories.js';

const KEY = 'category_settings';
const MAX_HIDDEN = 200;

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
			// fit נשמר רק כשיש תמונה והוא שונה מברירת המחדל (מרכז, בלי זום)
			if (image && anyV.imageFit) {
				const fit = sanitizeCategoryFit(anyV.imageFit);
				if (!isDefaultCategoryFit(fit)) o.imageFit = fit;
			}
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
			const fit = image && x.imageFit ? sanitizeCategoryFit(x.imageFit) : null;
			const aliases = Array.isArray(x.aliases)
				? [
						...new Set(
							x.aliases
								.map((/** @type {unknown} */ a) => cleanStr(a, 40))
								.filter((/** @type {string} */ a) => a && a !== name)
						)
					]
				: [];
			extras.push({
				key,
				name,
				...(icon ? { icon } : {}),
				...(image ? { image } : {}),
				...(fit && !isDefaultCategoryFit(fit) ? { imageFit: fit } : {}),
				aliases
			});
		}
	}

	// תוויות שנמחקו — מובנות שהוסתרו וגם שמות של extras שנמחקו, ולכן אין
	// כאן סינון מול הרשימה שבקוד. "אחר" אינה ניתנת למחיקה. התקרה מונעת
	// צבירה אינסופית של שמות ישנים ב-KV.
	const hidden = Array.isArray(s.hidden)
		? [
				...new Set(
					s.hidden
						.map((/** @type {unknown} */ k) => cleanStr(k, 80))
						.filter((/** @type {string} */ l) => l && l !== OTHER)
				)
			].slice(0, MAX_HIDDEN)
		: [];

	return { order, overrides, extras, hidden };
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
 * זורק על כישלון — מסך הניהול מציג את השגיאה במקום "נשמר" כוזב.
 * @param {import('$lib/categories.js').CategorySettings} settings
 */
export async function saveCategorySettings(settings) {
	await setConfigValueStrict(KEY, sanitize(settings));
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

/**
 * התווית שטופס העריכה יציג ככרטיסייה הנוכחית: מה שנשמר בה — אלא אם
 * הקטגוריה נמחקה ממסך הניהול, ואז הסיווג החי (אוטומטי או "אחר"). בלי זה
 * הטופס היה מציג תווית מתה כאופציה נבחרת ושומר אותה שוב בכל עריכה, בעוד
 * האתר כבר מציג את הכרטיסייה תחת תחום אחר.
 * @param {{category?: string, name?: string, subcategory?: string, description?: string, unique_content?: string}} biz
 * @returns {Promise<string>}
 */
export async function liveCategory(biz) {
	const raw = String(biz?.category ?? '').trim();
	if (!raw) return '';
	const retired = retiredLabelSet(await getCategorySettings());
	if (!retired.has(normCategoryLabel(raw))) return raw;
	return resolveCategory({ ...biz, category: '' }, retired);
}
