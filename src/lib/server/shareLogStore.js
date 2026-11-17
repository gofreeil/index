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
//
// תוכן הפריט (extra_fields):
//   entries     השורות (ראו shareLogMerge.js)
//   clearedAt   זמן "ניקוי הרשימה" האחרון
//   removed     מצבות מחיקה של שורות בודדות: { מפתח: זמן }
// ============================================================

import { env } from '$env/dynamic/private';
import { cleanRemoved, normalizeShareLog } from '$lib/shareLogMerge.js';

const STRAPI_URL = (env.STRAPI_URL || 'https://api.gofreeil.com').replace(/\/$/, '');
const TOKEN = env.STRAPI_TOKEN || '';
const ENDPOINT = '/api/items';
const CATEGORY = '__idx_shares';

/** @param {string|number} userId */
const labelOf = (userId) => `idx-shares:${userId}`;

/**
 * @typedef {Object} ShareState
 * @property {import('$lib/shareLogMerge.js').ShareEntry[]} entries
 * @property {number} clearedAt
 * @property {Record<string, number>} removed
 */

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
 * @returns {Promise<{ id: string|null } & ShareState>}
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
	const extra = item?.extra_fields ?? {};
	const clearedAt = Number(extra.clearedAt) || 0;
	const removed = cleanRemoved(extra.removed);
	return {
		id: item?.documentId ?? null,
		entries: normalizeShareLog(extra.entries, { clearedAt, removed }),
		clearedAt,
		removed
	};
}

/**
 * @param {string|number} userId
 * @param {string|null} id
 * @param {ShareState} state
 */
async function saveItem(userId, id, state) {
	const extra_fields = {
		entries: state.entries,
		clearedAt: state.clearedAt,
		removed: state.removed
	};
	if (id) {
		const res = await api(`${ENDPOINT}/${encodeURIComponent(id)}`, {
			method: 'PUT',
			body: JSON.stringify({ data: { extra_fields } })
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
				extra_fields,
				status1: 'active',
				publishedAt: new Date().toISOString()
			}
		})
	});
	if (!res.ok) throw new Error(`share-log POST → ${res.status}`);
}

/** @param {string|number} userId @returns {Promise<ShareState>} */
export async function getShareLog(userId) {
	const { entries, clearedAt, removed } = await loadItem(userId);
	return { entries, clearedAt, removed };
}

/**
 * ממזג שינויים לרשימה השמורה: שורות חדשות או ערוכות (שליחה, שם, הערה,
 * תזכורת, העברה מהדפדפן) ומצבות מחיקה. מחזיר את המצב המאוחד — הדפדפן
 * מציג אותו מיד, כולל שורות ממכשירים אחרים.
 * @param {string|number} userId
 * @param {{ entries?: any[], removed?: any }} change
 * @returns {Promise<ShareState>}
 */
export async function mergeShareLog(userId, change) {
	const cur = await loadItem(userId);
	const removed = cleanRemoved(maxMerge(cur.removed, change.removed));
	const entries = normalizeShareLog(
		[...(Array.isArray(change.entries) ? change.entries : []), ...cur.entries],
		{ clearedAt: cur.clearedAt, removed }
	);
	const next = { entries, clearedAt: cur.clearedAt, removed };
	// שום דבר לא השתנה (סנכרון שגרתי של דפדפן מעודכן) — חוסכים כתיבה
	if (
		JSON.stringify(entries) !== JSON.stringify(cur.entries) ||
		JSON.stringify(removed) !== JSON.stringify(cur.removed)
	) {
		await saveItem(userId, cur.id, next);
	}
	return next;
}

/**
 * מצבה חדשה לא מוחלפת במצבה ישנה יותר של אותה שורה — המאוחרת מנצחת.
 * @param {Record<string, number>} current
 * @param {any} incoming
 */
function maxMerge(current, incoming) {
	/** @type {Record<string, number>} */
	const out = { ...current };
	for (const [k, v] of Object.entries(cleanRemoved(incoming))) {
		if (v > (out[k] || 0)) out[k] = v;
	}
	return out;
}

/** ניקוי היומן — "ניקוי הרשימה" באזור האישי. @param {string|number} userId */
export async function clearShareLogFor(userId) {
	const cur = await loadItem(userId);
	const clearedAt = Date.now();
	// אחרי ניקוי מלא המצבות מיותרות: כל מה שישן מ-clearedAt כבר נגרע
	await saveItem(userId, cur.id, { entries: [], clearedAt, removed: {} });
	return clearedAt;
}
