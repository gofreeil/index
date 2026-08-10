// ============================================================
// configStore.js — מחסן ערכים קטן לצד השרת (KV)
//
// נשמר באוסף ה-items המשותף של api.gofreeil.com תחת קטגוריה פנימית
// (__idx_config), כדי לא לדרוש שינוי סכמה ב-Strapi. הקטגוריה הזו אינה
// מוצגת באף אתר — כל אתר מסנן לפי הקטגוריות שלו.
//
// משמש כמטמון מתמיד לנתונים שיקרים לשליפה חוזרת:
//   visitors           מונה הצפיות בחודש הנוכחי (Google Analytics)
//   visitors_monthly   פירוט חודשי לשנה האחרונה (GA)
//   visitors_insights  תובנות שנתיות — דפים, ערים, מכשירים, מקורות תנועה (GA)
//   ad_stats           מדדי הפרסומות (ראו adStats.js — קטגוריה נפרדת)
//
// כל הכשלים שקטים: אם האוסף לא זמין, הקריאה מחזירה undefined והאתר
// ממשיך לעבוד בלי הנתון.
// ============================================================

import { env } from '$env/dynamic/private';

const STRAPI_URL = (env.STRAPI_URL || 'https://api.gofreeil.com').replace(/\/$/, '');
const TOKEN = env.STRAPI_TOKEN || '';
const ENDPOINT = '/api/items';
const CATEGORY = '__idx_config';

// מטמון בזיכרון — כדי שקריאה בכל טעינת עמוד לא תיצור סבב Strapi
const TTL_MS = 20_000;

/** @param {string} path @param {any} [init] */
async function api(path, init = {}) {
	const headers = /** @type {Record<string,string>} */ ({ ...(init.headers || {}) });
	if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
	if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
	return fetch(`${STRAPI_URL}${path}`, { ...init, headers });
}

/** @type {Record<string, unknown> | null} */
let cache = null;
/** @type {string | null} */
let itemId = null;
let loadedAt = 0;

/**
 * טוען את פריט ההגדרות (יחיד). נכשל בשקט ומחזיר את המטמון הקיים.
 * @param {boolean} [force]
 * @returns {Promise<Record<string, unknown>>}
 */
async function loadConfig(force = false) {
	if (!force && cache && Date.now() - loadedAt < TTL_MS) return cache;
	try {
		const res = await api(`${ENDPOINT}?filters[category][$eq]=${CATEGORY}&pagination[pageSize]=1`);
		if (!res.ok) throw new Error(`items → ${res.status}`);
		const data = await res.json().catch(() => null);
		const item = Array.isArray(data?.data) ? data.data[0] : null;
		itemId = item?.documentId ?? null;
		cache = /** @type {Record<string, unknown>} */ (item?.extra_fields ?? {});
		loadedAt = Date.now();
		return cache;
	} catch (e) {
		console.error('[configStore] load failed:', e instanceof Error ? e.message : e);
		cache = cache ?? {};
		return cache;
	}
}

/**
 * ממזג ערכים לפריט ההגדרות (לא דורס את מה שלא נשלח).
 * זורק על כתיבה כושלת; המטמון מתעדכן רק אחרי שהשרת אישר — אחרת האינסטנס
 * הזה היה מגיש 20 שניות ערכים שנראים שמורים ואינם.
 * @param {Record<string, unknown>} patch
 */
async function saveConfig(patch) {
	const current = await loadConfig(true);
	const merged = { ...current, ...patch };
	if (itemId) {
		const res = await api(`${ENDPOINT}/${itemId}`, {
			method: 'PUT',
			body: JSON.stringify({ data: { extra_fields: merged } })
		});
		if (!res.ok) throw new Error(`config PUT → ${res.status}`);
	} else {
		const res = await api(ENDPOINT, {
			method: 'POST',
			body: JSON.stringify({
				data: {
					label: 'index-config',
					category: CATEGORY,
					description: '[SYSTEM] הגדרות ומטמון של מדריך בעלי המקצוע',
					icon: '⚙️',
					extra_fields: merged,
					status1: 'active',
					publishedAt: new Date().toISOString()
				}
			})
		});
		if (!res.ok) throw new Error(`config POST → ${res.status}`);
		const data = await res.json().catch(() => null);
		itemId = data?.data?.documentId ?? null;
	}
	cache = merged;
	loadedAt = Date.now();
}

/**
 * קורא ערך מההגדרות (מטמון 20 שנ' — לא יוצר סבב Strapi נוסף).
 * @template T
 * @param {string} key
 * @returns {Promise<T | undefined>}
 */
export async function getConfigValue(key) {
	const cfg = await loadConfig();
	return /** @type {T | undefined} */ (cfg[key]);
}

/**
 * כותב ערך יחיד להגדרות (ממזג, לא דורס). נכשל בשקט — למטמוני רקע
 * (מוני מבקרים וכד') שכשל שלהם לא צריך להפיל טעינת דף.
 * @param {string} key
 * @param {unknown} value
 */
export async function setConfigValue(key, value) {
	try {
		await setConfigValueStrict(key, value);
	} catch (e) {
		console.error('[configStore] save failed:', e instanceof Error ? e.message : e);
	}
}

/**
 * כמו setConfigValue, אבל מפיץ כישלון — לשמירות שמאחוריהן משתמש שמחכה
 * לתשובה אמיתית (מסך ניהול הקטגוריות). בלי זה המסך הציג "נשמר בהצלחה"
 * גם כשהכתיבה ל-Strapi נכשלה.
 * @param {string} key
 * @param {unknown} value
 */
export async function setConfigValueStrict(key, value) {
	await saveConfig({ [key]: value });
}
