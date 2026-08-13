// ============================================================
// searchStats.js — מה אנשים חיפשו כאן, וכמה מהם לחצו על טלפון
//
// עד כאן ידענו כמה גולשים נכנסו (GA) וכמה צפו בכל כרטיסייה (מוני Strapi),
// אבל לא ידענו *מה הם רצו*. שורת החיפוש היא המקום היחיד שבו הגולש אומר
// את זה במילים שלו, וכל הקלדה שם נזרקה.
//
// שני דברים נאספים, ושניהם עונים על אותה שאלה עסקית:
//   • כל ביטוי שחופש, כמה פעמים, ומתוכם כמה פעמים הוא החזיר אפס תוצאות.
//     ביטוי מבוקש בלי תוצאות הוא בדיוק רשימת בעלי המקצוע שכדאי לגייס.
//   • כמה לחיצות טלפון היו, לפי יום, בשתי מדרגות: חשיפת המספר ("הצג מספר
//     טלפון") והחיוג עצמו. המונה לכל כרטיסייה כבר קיים ב-Strapi; מה שחסר
//     היה הקו לאורך זמן, וההפרש בין מי שהציץ למי שבאמת התקשר.
//
// פרטיות: נשמרים הביטוי, הספירה והתאריך בלבד. בלי כתובת IP, בלי מזהה
// משתמש ובלי מזהה סשן — אי אפשר לשחזר מכאן מה אדם מסוים חיפש.
//
// אחסון: פריט יחיד באוסף ה-items המשותף תחת קטגוריה פנימית
// (__idx_search_stats), בדיוק כמו מדדי הפרסומות. אין צורך בסכמה חדשה
// ב-Strapi, ולכן הכול עובד בלי נגיעה בבאקאנד.
//
// הספירה נצברת בזיכרון ונשטפת לכל היותר אחת לדקה: חיפוש הוא אירוע תכוף,
// וכתיבה ל-DB בכל הקלדה הייתה יקרה ומיותרת. הפריט נשמר קטן — 60 יום
// אחורה ו-400 הביטויים המובילים (תקרת koa-body היא 1MB לבקשה).
// ============================================================

import { env } from '$env/dynamic/private';
import { normCategoryLabel as norm } from '../categories.js';

const STRAPI_URL = (env.STRAPI_URL || 'https://api.gofreeil.com').replace(/\/$/, '');
const TOKEN = env.STRAPI_TOKEN || '';
const ENDPOINT = '/api/items';
const CATEGORY = '__idx_search_stats';

const FLUSH_INTERVAL_MS = 60_000;
const FLUSH_THRESHOLD = 20;
const KEEP_DAYS = 60;
const KEEP_QUERIES = 400;
const MAX_QUERY_LEN = 60;

/** מפתחות מיוחדים למוני הטלפון — לא ביטויי חיפוש.
 *  PHONE = לחיצה על "הצג מספר טלפון"; CALL = לחיצה על המספר עצמו (חיוג). */
const PHONE = '__phone';
const CALL = '__call';
const RESERVED = new Set([PHONE, CALL]);

/** @param {string} path @param {any} [init] */
async function api(path, init = {}) {
	const headers = /** @type {Record<string,string>} */ ({ ...(init.headers || {}) });
	if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
	if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
	return fetch(`${STRAPI_URL}${path}`, { ...init, headers });
}

// ---------- צבירה בזיכרון ----------
// מפתח: `${queryKey}|${YYYY-MM-DD}`. היום נקבע בזמן הרישום, כך ששטיפה
// שחוצה חצות לא מזיזה ספירות ליום הלא נכון.
/** @type {Map<string, {l: string, n: number, z: number}>} */
const pending = new Map();
let pendingCount = 0;
let lastFlush = 0;
let flushing = false;
/** @type {string|null} */
let statsItemId = null;

const today = () => new Date().toISOString().slice(0, 10);
/** @param {string} k */
const isDayKey = (k) => /^\d{4}-\d{2}-\d{2}$/.test(k);
/** @param {unknown} v */
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * הביטוי כפי שיישמר: רווחים מכווצים, אורך חסום. הנרמול (אותיות סופיות,
 * גרשיים) משמש כמפתח בלבד — התצוגה מראה את מה שהוקלד בפועל.
 * @param {unknown} raw
 * @returns {{key: string, label: string} | null}
 */
export function normalizeQuery(raw) {
	const label = String(raw ?? '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, MAX_QUERY_LEN);
	if (label.length < 2) return null;
	const key = norm(label);
	if (!key || RESERVED.has(key)) return null;
	return { key, label };
}

/** @param {any} target @param {{n?: number, z?: number}} add */
function addInto(target, add) {
	target.n = num(target.n) + num(add.n);
	target.z = num(target.z) + num(add.z);
	return target;
}

/** @param {unknown} raw @returns {Record<string, any>} */
function sanitizeStore(raw) {
	/** @type {Record<string, any>} */
	const out = {};
	if (!raw || typeof raw !== 'object') return out;
	for (const [key, val] of Object.entries(/** @type {any} */ (raw))) {
		if (!key || !val || typeof val !== 'object') continue;
		const rec = /** @type {any} */ (val);
		/** @type {any} */
		const clean = {
			l: String(rec.l ?? key).slice(0, MAX_QUERY_LEN),
			n: num(rec.n),
			z: num(rec.z),
			d: {}
		};
		if (rec.d && typeof rec.d === 'object') {
			for (const [day, counters] of Object.entries(rec.d)) {
				if (isDayKey(day)) clean.d[day] = addInto({}, /** @type {any} */ (counters ?? {}));
			}
		}
		out[key] = clean;
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
		return { id: statsItemId, store: sanitizeStore(item?.extra_fields?.search_stats) };
	} catch (e) {
		console.error('[searchStats] load failed:', e instanceof Error ? e.message : e);
		return { id: null, store: {} };
	}
}

/**
 * גורע ימים ישנים וביטויים נדירים — הפריט נשאר קטן גם אחרי שנים של תנועה.
 * מונה לחיצות הטלפון פטור מהגזירה: הוא שורה אחת, והיא לא אמורה להיעלם.
 * @param {Record<string,any>} store
 */
function prune(store) {
	const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
	for (const rec of Object.values(store)) {
		if (!rec?.d) continue;
		for (const day of Object.keys(rec.d)) {
			if (day < cutoff) delete rec.d[day];
		}
	}
	const keys = Object.keys(store).filter((k) => !RESERVED.has(k));
	if (keys.length <= KEEP_QUERIES) return;
	keys
		.sort((a, b) => num(store[b].n) - num(store[a].n))
		.slice(KEEP_QUERIES)
		.forEach((k) => delete store[k]);
}

/** שטיפה שכבר רצה. שתי דרכים מגיעות לכאן (הרישום עצמו והנתיב שממתין
 *  לפני שהוא מחזיר תשובה), ובלי זה השנייה הייתה חוזרת מיד ולא ממתינה
 *  לכתיבה שכבר באוויר — בדיוק המצב שבו הלמבדה נסגרת באמצע.
 *  @type {Promise<void>|null} */
let inflight = null;

/** שוטף את הצבירה ל-Strapi. לעולם לא זורק. */
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
		const { id, store } = await loadStats();
		for (const [mapKey, add] of batch) {
			const sep = mapKey.lastIndexOf('|');
			const key = mapKey.slice(0, sep);
			const day = mapKey.slice(sep + 1);
			const rec = (store[key] ??= { l: add.l, n: 0, z: 0, d: {} });
			// התווית מתעדכנת לצורה האחרונה שהוקלדה — אותו מפתח מנורמל יכול
			// להגיע גם כ"נדל״ן" וגם כ"נדלן"
			if (add.l) rec.l = add.l;
			addInto(rec, add);
			rec.d ??= {};
			rec.d[day] = addInto(rec.d[day] ?? {}, add);
			// תיקון-לאחור (החלפת ביטוי קודם) עלול להוריד מתחת לאפס אם השורה
			// הקודמת כבר נגזרה מהמאגר
			rec.n = Math.max(0, rec.n);
			rec.z = Math.max(0, rec.z);
			rec.d[day].n = Math.max(0, rec.d[day].n);
			rec.d[day].z = Math.max(0, rec.d[day].z);
		}
		prune(store);
		if (id) {
			await api(`${ENDPOINT}/${id}`, {
				method: 'PUT',
				body: JSON.stringify({ data: { extra_fields: { search_stats: store } } })
			});
		} else {
			const res = await api(ENDPOINT, {
				method: 'POST',
				body: JSON.stringify({
					data: {
						label: 'index-search-stats',
						category: CATEGORY,
						description: '[SYSTEM] חיפושים ולחיצות טלפון — מדריך בעלי המקצוע',
						icon: '🔎',
						extra_fields: { search_stats: store },
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
		for (const [mapKey, add] of batch) {
			const cur = pending.get(mapKey) ?? { l: add.l, n: 0, z: 0 };
			pending.set(mapKey, addInto(cur, add));
		}
		pendingCount += batchCount;
		console.error('[searchStats] flush failed:', e instanceof Error ? e.message : e);
	} finally {
		flushing = false;
	}
}

/** האם הגיע הזמן לשטוף */
const flushDue = () =>
	pendingCount >= FLUSH_THRESHOLD || Date.now() - lastFlush > FLUSH_INTERVAL_MS;

/**
 * שטיפה שאפשר להמתין לה. הנתיב שרושם את האירועים קורא לה לפני שהוא מחזיר
 * תשובה: על Vercel הלמבדה עלולה להיסגר ברגע שהתשובה יצאה, ו-void flush()
 * שלא הספיק היה מאבד את הצבירה. לעולם לא זורק.
 */
export async function flushIfDue() {
	if (flushDue()) await flush();
}

function maybeFlush() {
	if (flushDue()) void flush();
}

/** @param {string} key @param {string} label @param {{n?: number, z?: number}} add */
function bump(key, label, add) {
	const mapKey = `${key}|${today()}`;
	const cur = pending.get(mapKey) ?? { l: label, n: 0, z: 0 };
	if (label) cur.l = label;
	pending.set(mapKey, addInto(cur, add));
	pendingCount++;
}

/**
 * @typedef {Object} SearchEvent
 * @property {string} q הביטוי שחופש
 * @property {boolean} [zero] החיפוש לא החזיר אף תוצאה
 * @property {{q: string, zero?: boolean}} [replaces] ביטוי קודם מאותה
 *   הקלדה, שהתבטל לטובת זה
 */

/**
 * רושם חיפושים. סינכרוני וזול — הכתיבה ל-DB נדחית לשטיפה.
 *
 * replaces הוא התיקון-לאחור של הקלדה מתמשכת: מי שהקליד "חשמ", עצר, והמשיך
 * ל"חשמלאי" נספר פעם אחת בלבד — הביטוי החלקי נגרע כשהמלא נרשם. בלעדיו
 * רשימת "מה חיפשו" הייתה מלאה בקידומות של מילים.
 *
 * הגריעה נושאת איתה את ה-zero של הביטוי שנגרע ולא את זה של החדש: "חשמ"
 * שהחזיר תוצאות ו"חשמלאי" שלא, מורידים n אחד ו-z אפס. אחרת מונה
 * "חיפושים ללא תוצאה" של הביטוי הקודם היה נשחק בכל תיקון.
 * @param {SearchEvent[]} events
 */
export function recordSearches(events) {
	for (const ev of events) {
		const q = normalizeQuery(ev?.q);
		if (!q) continue;
		bump(q.key, q.label, { n: 1, z: ev?.zero ? 1 : 0 });
		const prev = normalizeQuery(ev?.replaces?.q);
		if (prev && prev.key !== q.key) {
			bump(prev.key, prev.label, { n: -1, z: ev?.replaces?.zero ? -1 : 0 });
		}
	}
	maybeFlush();
}

/**
 * לחיצת טלפון. 'reveal' = "הצג מספר טלפון" (נספרת גם לכל כרטיסייה ב-Strapi,
 * וכאן נשמר הקו לאורך זמן); 'call' = לחיצה על המספר החשוף, כלומר חיוג בפועל.
 * ההפרש בין השתיים הוא כמה מהמציצים באמת התקשרו.
 * @param {'reveal'|'call'} [kind]
 */
export function recordPhoneClick(kind = 'reveal') {
	bump(kind === 'call' ? CALL : PHONE, '', { n: 1 });
	maybeFlush();
}

/** ממזג את הצבירה שעוד לא נשטפה — כדי שהמסך יראה מספרים עדכניים. @param {Record<string,any>} store */
function withPending(store) {
	if (pending.size === 0) return store;
	for (const [mapKey, add] of pending) {
		const sep = mapKey.lastIndexOf('|');
		const key = mapKey.slice(0, sep);
		const day = mapKey.slice(sep + 1);
		const rec = (store[key] = {
			...(store[key] ?? { l: add.l, n: 0, z: 0 }),
			d: { ...(store[key]?.d ?? {}) }
		});
		if (add.l) rec.l = add.l;
		addInto(rec, add);
		rec.d[day] = addInto({ ...(rec.d[day] ?? {}) }, add);
	}
	return store;
}

/**
 * @typedef {Object} SearchStats
 * @property {{searches: number, zero: number, phone: number, calls: number, terms: number}} totals
 * @property {{q: string, count: number, zero: number}[]} top הביטויים המבוקשים
 * @property {{q: string, count: number}[]} gaps ביטויים שכמעט תמיד חוזרים ריקים
 * @property {{date: string, searches: number, phone: number, calls: number}[]} days
 * @property {number} updatedAt
 */

/**
 * כל התמונה — לתצוגה במסך הסטטיסטיקה. זורק רק אם האוסף לא זמין בכלל;
 * הקורא עוטף ב-catch.
 * @param {{days?: number, limit?: number}} [opts]
 * @returns {Promise<SearchStats>}
 */
export async function getSearchStats({ days = 30, limit = 12 } = {}) {
	const { store } = await loadStats();
	const merged = withPending(store);

	const phoneRec = merged[PHONE];
	const callRec = merged[CALL];
	/** @type {{q: string, count: number, zero: number}[]} */
	const rows = [];
	for (const [key, rec] of Object.entries(merged)) {
		if (RESERVED.has(key)) continue;
		const count = num(rec?.n);
		if (count <= 0) continue;
		rows.push({ q: String(rec?.l ?? key), count, zero: num(rec?.z) });
	}
	rows.sort((a, b) => b.count - a.count || a.q.localeCompare(b.q, 'he'));

	/** @type {{date: string, searches: number, phone: number, calls: number}[]} */
	const timeline = [];
	const now = Date.now();
	for (let i = days - 1; i >= 0; i--) {
		const date = new Date(now - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
		let searches = 0;
		for (const [key, rec] of Object.entries(merged)) {
			if (RESERVED.has(key)) continue;
			searches += num(rec?.d?.[date]?.n);
		}
		timeline.push({
			date,
			searches,
			phone: num(phoneRec?.d?.[date]?.n),
			calls: num(callRec?.d?.[date]?.n)
		});
	}

	return {
		totals: {
			searches: rows.reduce((s, r) => s + r.count, 0),
			zero: rows.reduce((s, r) => s + r.zero, 0),
			phone: num(phoneRec?.n),
			calls: num(callRec?.n),
			terms: rows.length
		},
		top: rows.slice(0, limit),
		// "חור במאגר": ביטוי שרוב הפעמים שחופש לא החזיר כלום. יחס ולא מספר
		// מוחלט — ביטוי שחופש 40 פעם ורק פעמיים היה ריק אינו חסר באינדקס.
		gaps: rows
			.filter((r) => r.zero >= 2 && r.zero / r.count >= 0.6)
			.sort((a, b) => b.zero - a.zero)
			.slice(0, limit)
			.map((r) => ({ q: r.q, count: r.zero })),
		days: timeline,
		updatedAt: Date.now()
	};
}

/**
 * הביטויים המבוקשים ביותר, כרשימת מחרוזות — מזינים את הצעת התגיות בטופס
 * ההגשה ($lib/tagSuggest). נכשל בשקט: בלי הרשימה ההצעות עדיין עובדות.
 * @param {number} [limit]
 * @returns {Promise<string[]>}
 */
export async function getTopQueries(limit = 60) {
	try {
		const { store } = await loadStats();
		return Object.entries(withPending(store))
			.filter(([key, rec]) => !RESERVED.has(key) && num(rec?.n) > 0)
			.sort((a, b) => num(b[1]?.n) - num(a[1]?.n))
			.slice(0, limit)
			.map(([key, rec]) => String(rec?.l ?? key));
	} catch {
		return [];
	}
}
