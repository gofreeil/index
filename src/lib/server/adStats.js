// ============================================================
// adStats.js — מדדי הפרסומות שהמפרסם רואה באזור האישי
// פורט מ-national-gemach/src/lib/server/adStats.ts אל index.
// ------------------------------------------------------------
// ארבעה מדדים לכל מודעה:
//   impressions — חשיפות (המודעה נראתה בסרגל הצד / בבאנר / במגירת הנייד)
//   clicks      — קליקים על המודעה
//   landing     — צפיות בדף הנחיתה /ads/[id]
//   leads       — פניות: לחיצה על טלפון / וואטסאפ / אתר / מייל בדף הנחיתה
//
// אחסון: פריט יחיד באוסף ה-items המשותף תחת קטגוריה פנימית (__idx_ad_stats).
// הספירה נצברת בזיכרון ונשטפת ל-Strapi לכל היותר אחת לדקה, כדי לא לכתוב
// ל-DB בכל חשיפה. המדדים נשמרים במפתחות מקוצרים (i/c/v/l) ובחלוקה יומית
// מוגבלת ל-60 יום, כדי שהפריט יישאר קטן (תקרת koa-body היא 1MB לבקשה).
// ============================================================

import { env } from '$env/dynamic/private';

const STRAPI_URL = (env.STRAPI_URL || 'https://api.gofreeil.com').replace(/\/$/, '');
const TOKEN = env.STRAPI_TOKEN || '';
const ENDPOINT = '/api/items';
const CATEGORY = '__idx_ad_stats';

const FLUSH_INTERVAL_MS = 60_000;
const FLUSH_THRESHOLD = 25;
const KEEP_DAYS = 60;

/** @typedef {'impressions'|'clicks'|'landing'|'leads'} AdMetric */
/** @type {AdMetric[]} */
export const AD_METRICS = ['impressions', 'clicks', 'landing', 'leads'];

/** @type {Record<AdMetric, 'i'|'c'|'v'|'l'>} */
const SHORT = { impressions: 'i', clicks: 'c', landing: 'v', leads: 'l' };
/** @type {('i'|'c'|'v'|'l')[]} */
const SHORT_KEYS = ['i', 'c', 'v', 'l'];

/**
 * @typedef {Object} AdCounters
 * @property {number} impressions
 * @property {number} clicks
 * @property {number} landing
 * @property {number} leads
 */

/**
 * @typedef {AdCounters & {date: string}} AdDayCounters
 */

/**
 * @typedef {Object} AdStats
 * @property {AdCounters} totals
 * @property {AdDayCounters[]} days N הימים האחרונים, כולל ימים ריקים — לגרף
 */

/** @param {string} path @param {any} [init] */
async function api(path, init = {}) {
	const headers = /** @type {Record<string,string>} */ ({ ...(init.headers || {}) });
	if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
	if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
	return fetch(`${STRAPI_URL}${path}`, { ...init, headers });
}

// ---------- צבירה בזיכרון ----------
// מפתח: `${adId}|${YYYY-MM-DD}` — היום נקבע בזמן הרישום, כך ששטיפה שחוצה
// חצות לא מזיזה ספירות ליום הלא נכון.
/** @type {Map<string, Record<string, number>>} */
const pending = new Map();
let pendingCount = 0;
let lastFlush = 0;
let flushing = false;
/** @type {string|null} */
let statsItemId = null;

const today = () => new Date().toISOString().slice(0, 10);
/** @param {string} k */
const isDayKey = (k) => /^\d{4}-\d{2}-\d{2}$/.test(k);

/** @param {Record<string,number>} target @param {Record<string,number>} add */
function addInto(target, add) {
	for (const key of SHORT_KEYS) {
		const n = Number(add[key]);
		if (Number.isFinite(n) && n !== 0) target[key] = (Number(target[key]) || 0) + n;
	}
	return target;
}

/** @param {unknown} raw @returns {Record<string, any>} */
function sanitizeStore(raw) {
	/** @type {Record<string, any>} */
	const out = {};
	if (!raw || typeof raw !== 'object') return out;
	for (const [adId, val] of Object.entries(/** @type {any} */ (raw))) {
		if (!adId || !val || typeof val !== 'object') continue;
		const rec = /** @type {any} */ (val);
		/** @type {any} */
		const clean = { t: addInto({}, rec.t ?? {}), d: {} };
		if (rec.d && typeof rec.d === 'object') {
			for (const [day, counters] of Object.entries(rec.d)) {
				if (isDayKey(day)) clean.d[day] = addInto({}, /** @type {any} */ (counters ?? {}));
			}
		}
		out[adId] = clean;
	}
	return out;
}

/** @returns {Promise<{id: string|null, store: Record<string, any>}>} */
async function loadStats() {
	try {
		const res = await api(`${ENDPOINT}?filters[category][$eq]=${CATEGORY}&pagination[pageSize]=1`);
		if (!res.ok) throw new Error(`items → ${res.status}`);
		const data = await res.json().catch(() => null);
		const item = Array.isArray(data?.data) ? data.data[0] : null;
		statsItemId = item?.documentId ?? null;
		return { id: statsItemId, store: sanitizeStore(item?.extra_fields?.ad_stats) };
	} catch (e) {
		console.error('[adStats] load failed:', e instanceof Error ? e.message : e);
		return { id: null, store: {} };
	}
}

/** גורע ימים ישנים — הפריט נשאר קטן גם אחרי שנים של תנועה. @param {Record<string,any>} store */
function pruneDays(store) {
	const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
	for (const rec of Object.values(store)) {
		if (!rec.d) continue;
		for (const day of Object.keys(rec.d)) {
			if (day < cutoff) delete rec.d[day];
		}
	}
}

/** שוטף את הצבירה ל-Strapi. לעולם לא זורק. */
async function flush() {
	if (flushing || pending.size === 0) return;
	flushing = true;
	const batch = new Map(pending);
	const batchCount = pendingCount;
	pending.clear();
	pendingCount = 0;
	try {
		const { id, store } = await loadStats();
		for (const [key, add] of batch) {
			const sep = key.lastIndexOf('|');
			const adId = key.slice(0, sep);
			const day = key.slice(sep + 1);
			const rec = (store[adId] ??= {});
			rec.t = addInto(rec.t ?? {}, add);
			rec.d ??= {};
			rec.d[day] = addInto(rec.d[day] ?? {}, add);
		}
		pruneDays(store);
		if (id) {
			await api(`${ENDPOINT}/${id}`, {
				method: 'PUT',
				body: JSON.stringify({ data: { extra_fields: { ad_stats: store } } })
			});
		} else {
			const res = await api(ENDPOINT, {
				method: 'POST',
				body: JSON.stringify({
					data: {
						label: 'index-ad-stats',
						category: CATEGORY,
						description: '[SYSTEM] מדדי פרסומות — מדריך בעלי המקצוע',
						icon: '📊',
						extra_fields: { ad_stats: store },
						status1: 'active',
						publishedAt: new Date().toISOString()
					}
				})
			});
			const data = await res.json().catch(() => null);
			statsItemId = data?.data?.documentId ?? null;
		}
		lastFlush = Date.now();
	} catch (e) {
		// מחזירים לצבירה — ננסה שוב בשטיפה הבאה
		for (const [key, add] of batch) {
			pending.set(key, addInto(pending.get(key) ?? {}, add));
		}
		pendingCount += batchCount;
		console.error('[adStats] flush failed:', e instanceof Error ? e.message : e);
	} finally {
		flushing = false;
	}
}

/**
 * רושם אירועי מדידה. סינכרוני וזול — הכתיבה ל-DB נדחית לשטיפה.
 * @param {{id: string, metric: AdMetric}[]} events
 */
export function recordAdEvents(events) {
	const day = today();
	for (const ev of events) {
		const id = (ev?.id ?? '').trim();
		const short = SHORT[ev?.metric];
		if (!id || !short) continue;
		const key = `${id}|${day}`;
		const cur = pending.get(key) ?? {};
		cur[short] = (cur[short] ?? 0) + 1;
		pending.set(key, cur);
		pendingCount++;
	}
	if (pendingCount >= FLUSH_THRESHOLD || Date.now() - lastFlush > FLUSH_INTERVAL_MS) {
		void flush();
	}
}

/** @param {Record<string,number>|undefined} raw @returns {AdCounters} */
const toCounters = (raw) => ({
	impressions: Number(raw?.i) || 0,
	clicks: Number(raw?.c) || 0,
	landing: Number(raw?.v) || 0,
	leads: Number(raw?.l) || 0
});

/** ממזג את הצבירה שעוד לא נשטפה — כדי שהדשבורד יראה מספרים עדכניים. @param {Record<string,any>} store */
function withPending(store) {
	if (pending.size === 0) return store;
	for (const [key, add] of pending) {
		const sep = key.lastIndexOf('|');
		const adId = key.slice(0, sep);
		const day = key.slice(sep + 1);
		const rec = (store[adId] ??= {});
		rec.t = addInto({ ...(rec.t ?? {}) }, add);
		rec.d = { ...(rec.d ?? {}) };
		rec.d[day] = addInto({ ...(rec.d[day] ?? {}) }, add);
	}
	return store;
}

/** @param {any} rec @param {number} days @returns {AdDayCounters[]} */
function lastDays(rec, days) {
	/** @type {AdDayCounters[]} */
	const out = [];
	const now = Date.now();
	for (let i = days - 1; i >= 0; i--) {
		const date = new Date(now - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
		out.push({ date, ...toCounters(rec?.d?.[date]) });
	}
	return out;
}

/**
 * המדדים של המודעות המבוקשות. מודעה בלי תנועה מקבלת אפסים (ולא נעדרת).
 * @param {string[]} ids @param {number} [days]
 * @returns {Promise<Record<string, AdStats>>}
 */
export async function getAdStats(ids, days = 14) {
	/** @type {Record<string, AdStats>} */
	const out = {};
	if (!ids.length) return out;
	const { store } = await loadStats();
	const merged = withPending(store);
	for (const id of ids) {
		out[id] = { totals: toCounters(merged[id]?.t), days: lastDays(merged[id], days) };
	}
	return out;
}

/**
 * סיכום המדדים של כל המודעות יחד — לכרטיס הסקירה במסך הסטטיסטיקה.
 * @returns {Promise<AdCounters>}
 */
export async function getAdStatsTotals() {
	const { store } = await loadStats();
	const merged = withPending(store);
	const sum = { impressions: 0, clicks: 0, landing: 0, leads: 0 };
	for (const rec of Object.values(merged)) {
		const c = toCounters(rec?.t);
		sum.impressions += c.impressions;
		sum.clicks += c.clicks;
		sum.landing += c.landing;
		sum.leads += c.leads;
	}
	return sum;
}
