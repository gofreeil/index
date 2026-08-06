// ============================================================
// claimsStore.js — בקשות בעלות על כרטיסיות ("זה העסק שלי")
//
// כל 93 הכרטיסיות במאגר הוזרמו בייבוא ונוצרו בלי שיוך-משתמש. כשמשתמש
// נרשם לאתר, המערכת מזהה את הכרטיסייה שלו לפי טלפון או אימייל (ראו
// ownerMatch.js) — אבל *התאמה אינה בעלות*: המשתמש צריך לדרוש את
// הכרטיסייה, אדמין מאשר, ורק אז נכתב עליה השיוך והוא רשאי לערוך אותה.
// זו נקודת האימות היחידה שיש (אין SMS/מייל אימות), ולכן היא ידנית.
//
// אחסון: פריט יחיד באוסף ה-items המשותף תחת קטגוריה פנימית
// (__idx_claims), באותו דפוס של configStore/adStats — כדי לא לדרוש
// שינוי סכמה ב-Strapi. הנפח זעום (בקשה לכרטיסייה, פעם אחת בחיים).
//
// סטטוסים:
//   pending    המשתמש דרש, ממתין להכרעת אדמין
//   approved   אושר — הכרטיסייה שויכה אליו
//   rejected   נדחה
//   dismissed  אדמין סימן "התעלם" על התאמה אוטומטית שהמערכת הציעה
//              (source='auto') — כדי שההתראה תרד ולא תחזור בכל טעינה
// ============================================================

import { randomBytes } from 'crypto';
import { env } from '$env/dynamic/private';

const STRAPI_URL = (env.STRAPI_URL || 'https://api.gofreeil.com').replace(/\/$/, '');
const TOKEN = env.STRAPI_TOKEN || '';
const ENDPOINT = '/api/items';
const CATEGORY = '__idx_claims';

const TTL_MS = 20_000;
// גג לרשומות שנשמרות — הישנות שהוכרעו נגרעות ראשונות, כדי שהפריט יישאר קטן
const KEEP = 400;
// הגנה מפני הצפה: כמה בקשות פתוחות מותר למשתמש אחד להחזיק בו-זמנית
const MAX_OPEN_PER_USER = 5;

/**
 * @typedef {Object} Claim
 * @property {string} id
 * @property {string} bizDocId   documentId של הכרטיסייה
 * @property {string} bizName    שם הכרטיסייה בזמן הבקשה (לתצוגה בפאנל)
 * @property {string} userId     מזהה המשתמש ב-Strapi
 * @property {string} userName
 * @property {string} userEmail
 * @property {string} userPhone  הטלפון מהפרופיל בזמן הבקשה
 * @property {'phone'|'email'|'manual'} matchedBy מה קשר בין המשתמש לכרטיסייה
 * @property {'user'|'auto'} source בקשה של המשתמש, או התאמה שהמערכת הציעה
 * @property {'pending'|'approved'|'rejected'|'dismissed'} status
 * @property {string} note       הודעה חופשית מהדורש
 * @property {string} createdAt
 * @property {string} decidedAt
 * @property {string} decidedBy
 */

/** @param {string} path @param {any} [init] */
async function api(path, init = {}) {
	const headers = /** @type {Record<string,string>} */ ({ ...(init.headers || {}) });
	if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
	if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
	return fetch(`${STRAPI_URL}${path}`, { ...init, headers });
}

/** @type {Claim[] | null} */
let cache = null;
/** @type {string | null} */
let itemId = null;
let loadedAt = 0;

/** @param {any} c @returns {Claim|null} */
function sanitize(c) {
	if (!c || typeof c !== 'object' || !c.id || !c.bizDocId || !c.userId) return null;
	const status = ['pending', 'approved', 'rejected', 'dismissed'].includes(c.status)
		? c.status
		: 'pending';
	return {
		id: String(c.id),
		bizDocId: String(c.bizDocId),
		bizName: String(c.bizName ?? ''),
		userId: String(c.userId),
		userName: String(c.userName ?? ''),
		userEmail: String(c.userEmail ?? ''),
		userPhone: String(c.userPhone ?? ''),
		matchedBy: ['phone', 'email', 'manual'].includes(c.matchedBy) ? c.matchedBy : 'manual',
		source: c.source === 'auto' ? 'auto' : 'user',
		status,
		note: String(c.note ?? '').slice(0, 500),
		createdAt: String(c.createdAt ?? ''),
		decidedAt: String(c.decidedAt ?? ''),
		decidedBy: String(c.decidedBy ?? '')
	};
}

/**
 * טוען את רשימת הבקשות. נכשל בשקט ומחזיר את המטמון הקיים (או ריק) —
 * תקלה ב-Strapi לא תפיל דף עסק או את האזור האישי.
 * @param {boolean} [force]
 * @returns {Promise<Claim[]>}
 */
async function loadClaims(force = false) {
	if (!force && cache && Date.now() - loadedAt < TTL_MS) return cache;
	try {
		const res = await api(`${ENDPOINT}?filters[category][$eq]=${CATEGORY}&pagination[pageSize]=1`);
		if (!res.ok) throw new Error(`items → ${res.status}`);
		const data = await res.json().catch(() => null);
		const item = Array.isArray(data?.data) ? data.data[0] : null;
		itemId = item?.documentId ?? null;
		const raw = item?.extra_fields?.claims;
		cache = (Array.isArray(raw) ? raw : []).map(sanitize).filter((c) => c !== null);
		loadedAt = Date.now();
		return cache;
	} catch (e) {
		console.error('[claims] load failed:', e instanceof Error ? e.message : e);
		cache = cache ?? [];
		return cache;
	}
}

/** גורע רשומות ישנות שכבר הוכרעו, ומשאיר את הפתוחות תמיד. @param {Claim[]} list */
function prune(list) {
	if (list.length <= KEEP) return list;
	const open = list.filter((c) => c.status === 'pending');
	const closed = list
		.filter((c) => c.status !== 'pending')
		.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
		.slice(0, Math.max(0, KEEP - open.length));
	return [...open, ...closed];
}

/** כותב את הרשימה המלאה. זורק בכישלון — הקורא מדווח למשתמש. @param {Claim[]} list */
async function saveClaims(list) {
	const claims = prune(list);
	if (itemId) {
		const res = await api(`${ENDPOINT}/${itemId}`, {
			method: 'PUT',
			body: JSON.stringify({ data: { extra_fields: { claims } } })
		});
		if (!res.ok) throw new Error(`claims PUT → ${res.status}`);
	} else {
		const res = await api(ENDPOINT, {
			method: 'POST',
			body: JSON.stringify({
				data: {
					label: 'index-claims',
					category: CATEGORY,
					description: '[SYSTEM] בקשות בעלות על כרטיסיות — מדריך בעלי המקצוע',
					icon: '🪪',
					extra_fields: { claims },
					status1: 'active',
					publishedAt: new Date().toISOString()
				}
			})
		});
		if (!res.ok) throw new Error(`claims POST → ${res.status}`);
		const data = await res.json().catch(() => null);
		itemId = data?.data?.documentId ?? null;
	}
	cache = claims;
	loadedAt = Date.now();
}

/** מאפס את המטמון — אחרי הכרעה, כדי שהבועה והרשימות יתעדכנו מיד. */
export function invalidateClaims() {
	cache = null;
	loadedAt = 0;
}

// ── קריאה ────────────────────────────────────────────────────

/** @returns {Promise<Claim[]>} */
export async function listClaims() {
	return [...(await loadClaims())];
}

/** הבקשות שממתינות להכרעת אדמין, מהחדשה לישנה. @returns {Promise<Claim[]>} */
export async function listPendingClaims() {
	return (await loadClaims())
		.filter((c) => c.status === 'pending')
		.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

/** הבקשות של משתמש מסוים. @param {string|number} userId @returns {Promise<Claim[]>} */
export async function listClaimsByUser(userId) {
	const uid = String(userId);
	return (await loadClaims())
		.filter((c) => c.userId === uid)
		.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

/**
 * הבקשה הפתוחה/המוכרעת של משתמש על כרטיסייה מסוימת (אם יש).
 * @param {string} bizDocId @param {string|number} userId @returns {Promise<Claim|null>}
 */
export async function findClaim(bizDocId, userId) {
	const uid = String(userId);
	const list = await loadClaims();
	return list.find((c) => c.bizDocId === bizDocId && c.userId === uid) ?? null;
}

/** כמה בקשות ממתינות להכרעה — למונה שבבועה. @returns {Promise<number>} */
export async function countPendingClaims() {
	try {
		return (await loadClaims()).filter((c) => c.status === 'pending').length;
	} catch {
		return 0;
	}
}

// ── כתיבה ────────────────────────────────────────────────────

/**
 * בקשת בעלות חדשה. בקשה קיימת על אותה כרטיסייה מאותו משתמש לא מוכפלת:
 * pending מוחזרת כמו שהיא, ובקשה שנדחתה בעבר נפתחת מחדש.
 * @param {{
 *   bizDocId: string, bizName: string,
 *   userId: string|number, userName?: string, userEmail?: string, userPhone?: string,
 *   matchedBy?: 'phone'|'email'|'manual', note?: string, source?: 'user'|'auto',
 *   reclaim?: boolean
 * }} input
 * @returns {Promise<{ok: true, claim: Claim} | {ok: false, error: string}>}
 */
export async function createClaim(input) {
	const uid = String(input.userId ?? '');
	if (!input.bizDocId || !uid) return { ok: false, error: 'בקשה לא תקינה' };

	const list = [...(await loadClaims(true))];
	const existing = list.find((c) => c.bizDocId === input.bizDocId && c.userId === uid);
	if (existing?.status === 'pending') return { ok: true, claim: existing };
	// בקשה שאושרה בעבר חוסמת בקשה חדשה — אלא אם הקורא כבר בדק שהכרטיסייה
	// אינה שלו (הבעלות נותקה או הועברה ממנו), ואז מותר לו לבקש אותה שוב
	if (existing?.status === 'approved' && !input.reclaim) {
		return { ok: false, error: 'הכרטיסייה כבר שויכה אליך' };
	}

	// המגבלה חלה על בקשות של משתמשים; שיוך יזום של אדמין אינו "בקשה"
	const open = list.filter((c) => c.userId === uid && c.status === 'pending').length;
	if (input.source !== 'auto' && open >= MAX_OPEN_PER_USER) {
		return { ok: false, error: 'יש לך כבר בקשות שממתינות לאישור. נטפל בהן ונחזור אליך.' };
	}

	/** @type {Claim} */
	const claim = {
		id: 'c_' + randomBytes(6).toString('hex'),
		bizDocId: input.bizDocId,
		bizName: String(input.bizName ?? ''),
		userId: uid,
		userName: String(input.userName ?? ''),
		userEmail: String(input.userEmail ?? ''),
		userPhone: String(input.userPhone ?? ''),
		matchedBy: input.matchedBy ?? 'manual',
		source: input.source === 'auto' ? 'auto' : 'user',
		status: 'pending',
		note: String(input.note ?? '').slice(0, 500),
		createdAt: new Date().toISOString(),
		decidedAt: '',
		decidedBy: ''
	};

	// בקשה שנדחתה/נסגרה בעבר מוחלפת ברשומה החדשה, כדי שלא יצטברו כפילויות
	const next = existing ? list.filter((c) => c.id !== existing.id) : list;
	try {
		await saveClaims([claim, ...next]);
	} catch (e) {
		console.error('[claims] create failed:', e instanceof Error ? e.message : e);
		return { ok: false, error: 'שמירת הבקשה נכשלה. נסו שוב עוד רגע.' };
	}
	return { ok: true, claim };
}

/**
 * הכרעת אדמין. מחזיר את הבקשה המעודכנת, או null אם לא נמצאה.
 * @param {string} claimId @param {'approved'|'rejected'} status @param {string} decidedBy
 * @returns {Promise<Claim|null>}
 */
export async function decideClaim(claimId, status, decidedBy) {
	const list = [...(await loadClaims(true))];
	const idx = list.findIndex((c) => c.id === claimId);
	if (idx === -1) return null;
	const decided = {
		...list[idx],
		status,
		decidedAt: new Date().toISOString(),
		decidedBy
	};
	list[idx] = decided;

	// אישור סוגר את שאר הבקשות הפתוחות על אותה כרטיסייה — יש לה בעלים אחד
	if (status === 'approved') {
		for (let i = 0; i < list.length; i++) {
			if (i !== idx && list[i].bizDocId === decided.bizDocId && list[i].status === 'pending') {
				list[i] = {
					...list[i],
					status: 'rejected',
					decidedAt: decided.decidedAt,
					decidedBy
				};
			}
		}
	}

	await saveClaims(list);
	return decided;
}

/**
 * "התעלם" מהתאמה אוטומטית שהמערכת הציעה — נשמרת רשומת dismissed כדי
 * שההתראה תרד ולא תחזור בכל טעינה של הפאנל.
 * @param {{bizDocId: string, bizName?: string, userId: string|number, userEmail?: string, decidedBy: string}} input
 */
export async function dismissMatch({ bizDocId, bizName, userId, userEmail, decidedBy }) {
	const uid = String(userId ?? '');
	if (!bizDocId || !uid) return;
	const list = [...(await loadClaims(true))];
	const existing = list.find((c) => c.bizDocId === bizDocId && c.userId === uid);
	const now = new Date().toISOString();
	if (existing) {
		if (existing.status === 'approved') return;
		list[list.indexOf(existing)] = {
			...existing,
			status: 'dismissed',
			decidedAt: now,
			decidedBy
		};
	} else {
		list.unshift({
			id: 'c_' + randomBytes(6).toString('hex'),
			bizDocId,
			bizName: String(bizName ?? ''),
			userId: uid,
			userName: '',
			userEmail: String(userEmail ?? ''),
			userPhone: '',
			matchedBy: 'manual',
			source: 'auto',
			status: 'dismissed',
			note: '',
			createdAt: now,
			decidedAt: now,
			decidedBy
		});
	}
	await saveClaims(list);
}
