// ============================================================
// shareLogStore.js — "למי שלחתי": יומן השליחות של השיתוף החכם, לפי משתמש
//
// עד עכשיו היומן ישב ב-localStorage בלבד, ולכן בעל עסק ששלח מהנייד לא
// ראה כלום באזור האישי כשנכנס מהמחשב (או אחרי ניקוי דפדפן) — הטבלה
// פשוט לא הופיעה. עכשיו היומן שייך לחשבון ועוקב אחריו בין מכשירים.
//
// הקריאה/כתיבה רק של המשתמש המחובר עצמו (ראו api/share-log): מספרי טלפון
// של מכרים הם מידע של צד שלישי, ולכן אין מסך אדמין ואין גישה של אחרים.
//
// אחסון: פריט אחד לכל משתמש באוסף ה-items המשותף, תחת קטגוריה פנימית
// (__idx_shares) — אותו דפוס כמו configStore/claimsStore, בלי שינוי סכמה.
// פריט לכל משתמש ולא פריט אחד לכולם: עד 200 שורות למשתמש כפול מאות
// מתנדבים היו מנפחים פריט יחיד למגה-בייטים שנכתבים מחדש בכל שליחה.
// ============================================================

import { env } from '$env/dynamic/private';
import { normalizeShareLog } from '$lib/shareLogMerge.js';

const STRAPI_URL = (env.STRAPI_URL || 'https://api.gofreeil.com').replace(/\/$/, '');
const TOKEN = env.STRAPI_TOKEN || '';
const ENDPOINT = '/api/items';
const CATEGORY = '__idx_shares';

/** @param {string|number} userId */
const labelOf = (userId) => `idx-shares:${userId}`;

/** @param {string} path @param {any} [init] */
async function api(path, init = {}) {
	const headers = /** @type {Record<string,string>} */ ({ ...(init.headers || {}) });
	if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
	if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
	return fetch(`${STRAPI_URL}${path}`, { ...init, headers });
}

/**
 * הפריט של המשתמש. זורק בכישלון רשת/שרת — הקורא מחזיר שגיאה לדפדפן,
 * שממשיך לעבוד מהעותק המקומי ומנסה שוב בסנכרון הבא.
 * @param {string|number} userId
 * @returns {Promise<{ id: string|null, entries: import('$lib/shareLogMerge.js').ShareEntry[], clearedAt: number }>}
 */
async function loadItem(userId) {
	const qs =
		`filters[category][$eq]=${CATEGORY}` +
		`&filters[label][$eq]=${encodeURIComponent(labelOf(userId))}` +
		`&pagination[pageSize]=1`;
	const res = await api(`${ENDPOINT}?${qs}`);
	if (!res.ok) throw new Error(`share-log GET → ${res.status}`);
	const data = await res.json().catch(() => null);
	const item = Array.isArray(data?.data) ? data.data[0] : null;
	return {
		id: item?.documentId ?? null,
		entries: normalizeShareLog(item?.extra_fields?.entries),
		clearedAt: Number(item?.extra_fields?.clearedAt) || 0
	};
}

/**
 * @param {string|number} userId
 * @param {string|null} id
 * @param {import('$lib/shareLogMerge.js').ShareEntry[]} entries
 * @param {number} clearedAt
 */
async function saveItem(userId, id, entries, clearedAt) {
	if (id) {
		const res = await api(`${ENDPOINT}/${encodeURIComponent(id)}`, {
			method: 'PUT',
			body: JSON.stringify({ data: { extra_fields: { entries, clearedAt } } })
		});
		if (!res.ok) throw new Error(`share-log PUT → ${res.status}`);
		return;
	}
	const res = await api(ENDPOINT, {
		method: 'POST',
		body: JSON.stringify({
			data: {
				label: labelOf(userId),
				category: CATEGORY,
				description: '[SYSTEM] יומן שליחות של השיתוף החכם — מדריך בעלי המקצוע',
				icon: '📨',
				extra_fields: { entries, clearedAt },
				status1: 'active',
				publishedAt: new Date().toISOString()
			}
		})
	});
	if (!res.ok) throw new Error(`share-log POST → ${res.status}`);
}

/** @param {string|number} userId */
export async function getShareLog(userId) {
	const { entries, clearedAt } = await loadItem(userId);
	return { entries, clearedAt };
}

/**
 * ממזג שורות חדשות (שליחה, מתן שם, או העברה מהדפדפן) לרשימה השמורה.
 * מחזיר את הרשימה המאוחדת — הדפדפן מציג אותה מיד, גם שורות ממכשירים אחרים.
 * שורות שישנות מרגע הניקוי האחרון נזרקות: בלי זה מכשיר שעדיין מחזיק עותק
 * מקומי היה מחזיר לרשימה את מה שהמשתמש ניקה במכשיר אחר.
 * @param {string|number} userId
 * @param {any[]} incoming
 */
export async function mergeShareLog(userId, incoming) {
	const { id, entries, clearedAt } = await loadItem(userId);
	const fresh = (Array.isArray(incoming) ? incoming : []).filter(
		(e) => (Number(e?.at) || 0) > clearedAt
	);
	const merged = normalizeShareLog([...fresh, ...entries]);
	// שום דבר לא השתנה (סנכרון שגרתי של דפדפן מעודכן) — חוסכים כתיבה
	if (merged.length !== entries.length || JSON.stringify(merged) !== JSON.stringify(entries)) {
		await saveItem(userId, id, merged, clearedAt);
	}
	return { entries: merged, clearedAt };
}

/** ניקוי היומן — "ניקוי הרשימה" באזור האישי. @param {string|number} userId */
export async function clearShareLogFor(userId) {
	const { id } = await loadItem(userId);
	const clearedAt = Date.now();
	await saveItem(userId, id, [], clearedAt);
	return clearedAt;
}
