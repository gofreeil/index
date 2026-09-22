// ============================================================
// profileStore.js — פרטי הפרופיל *רק באתר הזה*
//
// רשימת המשתמשים של הרשת אחת היא (api.gofreeil.com): אותו חשבון משרת את
// מדריך בעלי המקצוע, את קהילה בשכונה ואת שאר אתרי יוצאים לחירות. לכן כל
// כתיבה לרשומת המשתמש ב-Strapi *היא* שינוי בכל האתרים — אין דרך לשנות שם
// או טלפון "רק כאן" דרכה.
//
// כשהמשתמש עורך את הפרופיל הוא נשאל לאן השינוי הולך:
//   בכל האתרים  → נכתב לרשומה המשותפת ב-Strapi, והדריסה המקומית נמחקת
//                 (אחרת ערך ישן שמור כאן היה ממשיך להסתיר את החדש)
//   רק כאן      → נשמר פה, ורק האתר הזה מציג אותו ומתאים לפיו כרטיסיות
//
// אחסון: מפתח אחד (site_profiles) בפריט ההגדרות של האתר (configStore) —
// מפה של userId → { name, phone }. הנפח זעום: שורה למשתמש שבחר "רק כאן",
// ורוב המשתמשים לא יבחרו בזה בכלל.
// ============================================================

import { getConfigValue, setConfigValueStrict } from './configStore.js';
import { getUserPhone } from './strapi.js';

const KEY = 'site_profiles';

/**
 * @typedef {Object} SiteProfile
 * @property {string} name   שם תצוגה מקומי ('' = אין דריסה)
 * @property {string} phone  טלפון מקומי ('' = אין דריסה)
 * @property {string} updatedAt
 */

/** כל הדריסות המקומיות. נכשל בשקט (מפה ריקה). @returns {Promise<Record<string, SiteProfile>>} */
async function allProfiles() {
	try {
		const v = await getConfigValue(KEY);
		return v && typeof v === 'object' ? /** @type {Record<string, SiteProfile>} */ (v) : {};
	} catch {
		return {};
	}
}

/**
 * הדריסה המקומית של משתמש אחד, או null. נקרא בכל בקשה של משתמש מחובר
 * (hooks) — ולכן נשען על המטמון של configStore ולא יוצר סבב Strapi נוסף.
 * @param {string|number} userId
 * @returns {Promise<SiteProfile | null>}
 */
export async function getSiteProfile(userId) {
	const key = String(userId ?? '');
	if (!key) return null;
	const all = await allProfiles();
	return all[key] ?? null;
}

/**
 * שומר דריסה מקומית. זורק על כישלון — מאחורי הקריאה עומד משתמש שמחכה
 * לתשובה אמיתית, ו"נשמר" מזויף כאן פירושו שם שנעלם בטעינה הבאה.
 * @param {string|number} userId @param {{name?: string, phone?: string}} patch
 */
export async function setSiteProfile(userId, patch) {
	const key = String(userId ?? '');
	if (!key) return;
	const all = await allProfiles();
	const next = {
		...(all[key] ?? { name: '', phone: '' }),
		...patch,
		updatedAt: new Date().toISOString()
	};
	await setConfigValueStrict(KEY, { ...all, [key]: next });
}

/**
 * מוחק את הדריסה המקומית — נקרא כשהמשתמש בוחר להחיל בכל האתרים, כדי
 * שהערך המשותף החדש יהיה זה שמוצג גם כאן.
 * @param {string|number} userId
 */
export async function clearSiteProfile(userId) {
	const key = String(userId ?? '');
	if (!key) return;
	const all = await allProfiles();
	if (!(key in all)) return;
	const { [key]: _drop, ...rest } = all;
	await setConfigValueStrict(KEY, rest);
}

/**
 * הטלפון שהאתר הזה מכיר: הדריסה המקומית אם יש, אחרת המספר המשותף
 * מ-Strapi. זה המספר שמנוע ההתאמה עובד לפיו — אחרת משתמש שתיקן מספר
 * "רק כאן" היה ממשיך לראות התאמות לפי המספר הישן.
 * @param {string|number} userId @returns {Promise<string>}
 */
export async function getEffectivePhone(userId) {
	const o = await getSiteProfile(userId);
	if (o?.phone) return o.phone;
	return getUserPhone(userId);
}

/**
 * מחיל את הדריסות המקומיות על רשימת משתמשים רזה (listUsersSlim) — כדי
 * שמנוע ההתאמה ומסך הבעלות ישתמשו באותו טלפון שהאתר הזה מציג למשתמש.
 * @template {{id: string, name: string, phone: string}} T
 * @param {T[]} rows
 * @returns {Promise<T[]>}
 */
export async function applySiteProfiles(rows) {
	const all = await allProfiles();
	if (!Object.keys(all).length) return rows;
	return rows.map((r) => {
		const o = all[String(r.id)];
		if (!o) return r;
		return { ...r, name: o.name || r.name, phone: o.phone || r.phone };
	});
}
