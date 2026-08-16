// ============================================================
// categoryClicks.js — אילו כרטיסים נפתחו מתוך כל תחום ("מי שחיפש X הגיע אל")
//
// המנוע החכם שבתחתית תוצאות הסינון: מי שגולש בתוך תחום ולוחץ על כרטיסייה
// מלמד את האתר שהכרטיס הזה מעניין את מחפשי התחום. הצבירה כאן היא הזיכרון —
// ספירת לחיצות לכל צמד (תחום, עסק) — ודף הבית שולף ממנה את המובילים ומציג
// אותם כהמלצה: "מי שחיפשו בתחום הזה הגיעו גם אל הכרטיסים האלה".
//
// פרטיות: נשמרים תחום, מזהה כרטיסייה וספירה בלבד. בלי IP, בלי מזהה משתמש
// ובלי סשן — אי אפשר לשחזר מכאן מסלול של אדם מסוים (כמו ב-searchStats).
//
// אחסון: פריט יחיד באוסף ה-items המשותף תחת קטגוריה פנימית
// (__idx_cat_clicks) — אותו דפוס בדיוק של מדדי החיפושים והפרסומות: בלי
// סכמה חדשה ב-Strapi ובלי נגיעה בבאקאנד.
//
// הצבירה בזיכרון ונשטפת לכל היותר אחת לדקה; הפריט נגזר ל-60 תחומים
// ו-60 כרטיסים מובילים לתחום כדי להישאר קטן לאורך שנים.
// ============================================================

import { env } from '$env/dynamic/private';
import { normCategoryLabel as norm } from '../categories.js';

const STRAPI_URL = (env.STRAPI_URL || 'https://api.gofreeil.com').replace(/\/$/, '');
const TOKEN = env.STRAPI_TOKEN || '';
const ENDPOINT = '/api/items';
const CATEGORY = '__idx_cat_clicks';

const FLUSH_INTERVAL_MS = 60_000;
const FLUSH_THRESHOLD = 15;
const KEEP_CATEGORIES = 60;
const KEEP_IDS = 60;
const MAX_LABEL_LEN = 60;
const MAX_ID_LEN = 50;
/** כמה מזהים נמסרים לדף הבית לכל תחום */
const SERVE_LIMIT = 8;
/** דף הבית נטען בכל ביקור — הפריט נשלף מ-Strapi לכל היותר אחת לדקה */
const SERVE_TTL_MS = 60_000;

/** @param {string} path @param {any} [init] */
async function api(path, init = {}) {
	const headers = /** @type {Record<string,string>} */ ({ ...(init.headers || {}) });
	if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
	if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
	return fetch(`${STRAPI_URL}${path}`, { ...init, headers });
}

// ---------- צבירה בזיכרון ----------
// מפתח: התחום המנורמל. הערך נושא את התווית כפי שהוצגה (l) ואת ספירת
// הלחיצות לכל כרטיסייה.
/** @type {Map<string, {l: string, ids: Map<string, number>}>} */
const pending = new Map();
let pendingCount = 0;
let lastFlush = 0;
let flushing = false;
/** @type {string|null} */
let statsItemId = null;

/** @param {unknown} v */
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * תווית תחום כפי שתישמר. מחזיר null לתחום לא-שמיש (קצר מדי, או מפתח
 * מערכת שמתחיל ב-__).
 * @param {unknown} raw
 * @returns {{key: string, label: string} | null}
 */
function normalizeCategory(raw) {
	const label = String(raw ?? '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, MAX_LABEL_LEN);
	if (label.length < 2 || label.startsWith('__')) return null;
	const key = norm(label);
	if (!key || key.startsWith('__')) return null;
	return { key, label };
}

/** @param {unknown} raw */
function normalizeId(raw) {
	const id = String(raw ?? '').trim();
	// documentId של Strapi הוא מזהה אלפאנומרי; כל דבר אחר הוא רעש
	if (!id || id.length > MAX_ID_LEN || !/^[\w-]+$/.test(id)) return '';
	return id;
}

/** @param {unknown} raw @returns {Record<string, {l: string, ids: Record<string, number>}>} */
function sanitizeStore(raw) {
	/** @type {Record<string, {l: string, ids: Record<string, number>}>} */
	const out = {};
	if (!raw || typeof raw !== 'object') return out;
	for (const [key, val] of Object.entries(/** @type {any} */ (raw))) {
		if (!key || !val || typeof val !== 'object') continue;
		const rec = /** @type {any} */ (val);
		/** @type {Record<string, number>} */
		const ids = {};
		if (rec.ids && typeof rec.ids === 'object') {
			for (const [id, n] of Object.entries(rec.ids)) {
				const clean = normalizeId(id);
				if (clean && num(n) > 0) ids[clean] = num(n);
			}
		}
		out[key] = { l: String(rec.l ?? key).slice(0, MAX_LABEL_LEN), ids };
	}
	return out;
}

/** @returns {Promise<{id: string|null, store: Record<string, {l: string, ids: Record<string, number>}>}>} */
async function loadStore() {
	try {
		const res = await api(`${ENDPOINT}?filters[category][$eq]=${CATEGORY}&pagination[pageSize]=1`);
		if (!res.ok) throw new Error(`items → ${res.status}`);
		const data = await res.json().catch(() => null);
		const item = Array.isArray(data?.data) ? data.data[0] : null;
		statsItemId = item?.documentId ?? null;
		return { id: statsItemId, store: sanitizeStore(item?.extra_fields?.cat_clicks) };
	} catch (e) {
		console.error('[categoryClicks] load failed:', e instanceof Error ? e.message : e);
		return { id: null, store: {} };
	}
}

/** גוזר את הפריט כך שיישאר קטן: המובילים לכל תחום, והתחומים הפעילים בלבד.
 *  @param {Record<string, {l: string, ids: Record<string, number>}>} store */
function prune(store) {
	for (const [key, rec] of Object.entries(store)) {
		const entries = Object.entries(rec.ids).sort((a, b) => b[1] - a[1]);
		if (entries.length === 0) {
			delete store[key];
			continue;
		}
		if (entries.length > KEEP_IDS) rec.ids = Object.fromEntries(entries.slice(0, KEEP_IDS));
	}
	const keys = Object.keys(store);
	if (keys.length <= KEEP_CATEGORIES) return;
	const total = (/** @type {string} */ k) => Object.values(store[k].ids).reduce((s, n) => s + n, 0);
	keys
		.sort((a, b) => total(b) - total(a))
		.slice(KEEP_CATEGORIES)
		.forEach((k) => delete store[k]);
}

// ---------- מטמון הגשה ----------
// דף הבית קורא בכל ביקור; הפריט קטן אבל שליפה מ-Strapi לכל צפייה מיותרת.
/** @type {{at: number, store: Record<string, {l: string, ids: Record<string, number>}>} | null} */
let served = null;

/** שטיפה שכבר רצה — ראו searchStats על למה ממתינים לה. @type {Promise<void>|null} */
let inflight = null;

function flush() {
	if (pending.size === 0) return Promise.resolve();
	if (inflight) return inflight;
	inflight = runFlush().finally(() => {
		inflight = null;
	});
	return inflight;
}

async function runFlush() {
	if (flushing || pending.size === 0) return;
	flushing = true;
	const batch = new Map(pending);
	const batchCount = pendingCount;
	pending.clear();
	pendingCount = 0;
	try {
		const { id, store } = await loadStore();
		for (const [key, add] of batch) {
			const rec = (store[key] ??= { l: add.l, ids: {} });
			if (add.l) rec.l = add.l;
			for (const [bizId, n] of add.ids) rec.ids[bizId] = num(rec.ids[bizId]) + n;
		}
		prune(store);
		if (id) {
			await api(`${ENDPOINT}/${id}`, {
				method: 'PUT',
				body: JSON.stringify({ data: { extra_fields: { cat_clicks: store } } })
			});
		} else {
			const res = await api(ENDPOINT, {
				method: 'POST',
				body: JSON.stringify({
					data: {
						label: 'index-category-clicks',
						category: CATEGORY,
						description: '[SYSTEM] לחיצות על כרטיסיות לפי תחום — מדריך בעלי המקצוע',
						icon: '🧭',
						extra_fields: { cat_clicks: store },
						status1: 'active',
						publishedAt: new Date().toISOString()
					}
				})
			});
			const data = await res.json().catch(() => null);
			statsItemId = data?.data?.documentId ?? null;
		}
		lastFlush = Date.now();
		// מה שנשטף כבר לא ב-pending — מטמון ישן היה מעלים אותו עד שיפוג
		served = null;
	} catch (e) {
		for (const [key, add] of batch) {
			const cur = pending.get(key) ?? { l: add.l, ids: new Map() };
			if (add.l) cur.l = add.l;
			for (const [bizId, n] of add.ids) cur.ids.set(bizId, (cur.ids.get(bizId) ?? 0) + n);
			pending.set(key, cur);
		}
		pendingCount += batchCount;
		console.error('[categoryClicks] flush failed:', e instanceof Error ? e.message : e);
	} finally {
		flushing = false;
	}
}

const flushDue = () =>
	pendingCount >= FLUSH_THRESHOLD || Date.now() - lastFlush > FLUSH_INTERVAL_MS;

/** שטיפה שאפשר להמתין לה — הנתיב קורא לפני שהוא עונה (Vercel סוגר למבדה). */
export async function flushIfDue() {
	if (flushDue()) await flush();
}

/**
 * @typedef {Object} CategoryClickEvent
 * @property {string} c תווית התחום שהיה פעיל בסינון
 * @property {string} id ה-documentId של הכרטיסייה שנפתחה
 */

/**
 * רושם לחיצות. סינכרוני וזול — הכתיבה ל-DB נדחית לשטיפה.
 * @param {CategoryClickEvent[]} events
 */
export function recordCategoryClicks(events) {
	for (const ev of events) {
		const cat = normalizeCategory(ev?.c);
		const id = normalizeId(ev?.id);
		if (!cat || !id) continue;
		const rec = pending.get(cat.key) ?? { l: cat.label, ids: new Map() };
		rec.l = cat.label;
		rec.ids.set(id, (rec.ids.get(id) ?? 0) + 1);
		pending.set(cat.key, rec);
		pendingCount++;
	}
	if (flushDue()) void flush();
}

/**
 * המפה שדף הבית מציג: תחום (מנורמל) → מזהי הכרטיסיות שנפתחו ממנו, מהנלחץ
 * ביותר ומטה. ממוזגת עם הצבירה שטרם נשטפה כדי שהמלצה תופיע כבר בלחיצות
 * הראשונות. לעולם לא זורק — בלי היסטוריה דף הבית פשוט מציג את הכפתור הישן.
 * @returns {Promise<Record<string, string[]>>}
 */
export async function getRelatedMap() {
	try {
		if (!served || Date.now() - served.at > SERVE_TTL_MS) {
			const { store } = await loadStore();
			served = { at: Date.now(), store };
		}
		/** @type {Record<string, Record<string, number>>} */
		const merged = {};
		for (const [key, rec] of Object.entries(served.store)) merged[key] = { ...rec.ids };
		for (const [key, add] of pending) {
			const ids = (merged[key] ??= {});
			for (const [bizId, n] of add.ids) ids[bizId] = num(ids[bizId]) + n;
		}
		/** @type {Record<string, string[]>} */
		const out = {};
		for (const [key, ids] of Object.entries(merged)) {
			const top = Object.entries(ids)
				.filter(([, n]) => n > 0)
				.sort((a, b) => b[1] - a[1])
				.slice(0, SERVE_LIMIT)
				.map(([id]) => id);
			if (top.length) out[key] = top;
		}
		return out;
	} catch (e) {
		console.error('[categoryClicks] serve failed:', e instanceof Error ? e.message : e);
		return {};
	}
}
