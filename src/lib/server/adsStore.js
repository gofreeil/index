// ============================================================
// adsStore.js — מאגר פרסומות שנשלחו לאישור / אושרו
// פורט מ-community/my_new_project/src/lib/server/adsStore.ts אל index.
// אחסון: אוסף submitted-ad ב-Strapi המשותף (api.gofreeil.com).
// ההגשה נעשית בבילדר המקומי של האתר (/advertise/builder →
// /api/ads/submit → submitAd כאן); פרסומות שהוגשו מאתרים אחרים
// באותו אוסף ניתנות לאישור גם מכאן.
// הושמט ביחס למקור: מנגנון התזכורות (נשען על מערכת ההודעות של הקהילה
// שלא קיימת ב-index).
// לאוסף עמודות מוקלדות בלבד — אי אפשר להוסיף שדות חדשים, ולכן
// ערכי ההגשה החדשים ארוזים בתוך ה-JSON של landing:
//   landing._payment               'code' (קוד תנועה — כמו שולם) | 'pending'
//   landing._requestedDurationDays 30 | 180 (התקופה שהמפרסם ביקש)
//   landing._mainImageFit          {x,y,z} מיקום+זום התמונה הראשית מהבילדר
// ============================================================

import { env } from '$env/dynamic/private';
import { parseAdImageFit } from '$lib/adImageFit';

const STRAPI_URL = (env.STRAPI_URL || 'https://api.gofreeil.com').replace(/\/$/, '');
const TOKEN = env.STRAPI_TOKEN || '';
const ENDPOINT = '/api/submitted-ads';

const DEFAULT_DURATION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// פרסומות מאושרות נטענות בכל ניווט (ב-+layout.server) — cache קצר חוסך round-trip
const TTL_ADS = 120_000;

/** @typedef {'pending'|'approved'|'rejected'} AdStatus */

/**
 * @typedef {Object} SubmittedAd
 * @property {string} id
 * @property {AdStatus} status
 * @property {{id?:string,email?:string,name?:string}|undefined} submittedBy
 * @property {string} submittedAt
 * @property {string|undefined} decidedAt
 * @property {string|undefined} decidedBy
 * @property {string|undefined} rejectionReason
 * @property {string|undefined} expiresAt
 * @property {number|undefined} durationDays
 * @property {string|undefined} companyName
 * @property {number|undefined} paymentAmount
 * @property {string} title
 * @property {string} subtitle
 * @property {string} hoverText
 * @property {string} cta
 * @property {string} gradient
 * @property {string} logo
 * @property {string} mainImage
 * @property {{x:number,y:number,z:number}} mainImageFit מיקום+זום התמונה הראשית במשבצת (מהבילדר)
 * @property {any} landing
 * @property {string} payment "code" = הוזן קוד התנועה בשליחה (כמו שולם); "pending" = תשלום לתיאום
 * @property {number} requestedDurationDays התקופה שהמפרסם ביקש בשליחה (30/180) — ברירת המחדל באישור
 */

/** @param {string} path @param {any} [init] */
async function api(path, init = {}) {
	const headers = /** @type {Record<string,string>} */ ({ ...(init.headers || {}) });
	if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
	if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
	return fetch(`${STRAPI_URL}${path}`, { ...init, headers });
}

function emptyLanding() {
	return {
		headline: '',
		pitch: '',
		extended: '',
		image: '',
		advantages: ['', '', ''],
		uniqueness: '',
		phone: '',
		whatsapp: '',
		website: '',
		email: '',
		address: '',
		hours: '',
		products: []
	};
}

/** @param {any} s רשומת submitted-ad מ-Strapi (מבנה שטוח של Strapi 5) @returns {SubmittedAd} */
function fromStrapi(s) {
	return {
		id: s.documentId,
		status: s.ad_status,
		submittedBy:
			s.submitted_by_id || s.submitted_by_email || s.submitted_by_name
				? {
						id: s.submitted_by_id ?? undefined,
						email: s.submitted_by_email ?? undefined,
						name: s.submitted_by_name ?? undefined
					}
				: undefined,
		submittedAt: s.submitted_at ?? s.createdAt ?? new Date().toISOString(),
		decidedAt: s.decided_at ?? undefined,
		decidedBy: s.decided_by ?? undefined,
		rejectionReason: s.rejection_reason ?? undefined,
		expiresAt: s.expires_at ?? undefined,
		durationDays: s.duration_days ?? undefined,
		companyName: s.company_name ?? undefined,
		paymentAmount: s.payment_amount != null ? Number(s.payment_amount) : undefined,
		title: s.title ?? '',
		subtitle: s.subtitle ?? '',
		hoverText: s.hover_text ?? '',
		cta: s.cta ?? '',
		gradient: s.gradient ?? '',
		logo: s.logo ?? '',
		mainImage: s.main_image ?? '',
		landing: s.landing ?? emptyLanding(),
		// ערכי ההגשה הארוזים ב-landing (ראו כותרת הקובץ)
		mainImageFit: parseAdImageFit(s.landing?._mainImageFit),
		payment: s.landing?._payment === 'code' ? 'code' : 'pending',
		requestedDurationDays: Number(s.landing?._requestedDurationDays) === 180 ? 180 : 30
	};
}

/** @param {AdStatus} status @returns {Promise<SubmittedAd[]>} */
async function listByStatus(status) {
	/** @type {SubmittedAd[]} */
	const out = [];
	let page = 1;
	for (;;) {
		const qs =
			`filters[ad_status][$eq]=${status}&sort=submitted_at:desc` +
			`&pagination[pageSize]=100&pagination[page]=${page}`;
		const res = await api(`${ENDPOINT}?${qs}`);
		if (res.status === 404) return out; // האוסף לא רשום ב-Strapi — מחזירים ריק
		if (!res.ok) throw new Error(`strapi submitted-ads → ${res.status}`);
		const data = await res.json().catch(() => null);
		const items = Array.isArray(data?.data) ? data.data : [];
		out.push(...items.map(fromStrapi));
		const pageCount = data?.meta?.pagination?.pageCount ?? 1;
		if (page >= pageCount) return out;
		page++;
	}
}

/** @param {string} id @returns {Promise<any|null>} */
async function findByDocumentId(id) {
	const res = await api(`${ENDPOINT}/${encodeURIComponent(id)}`);
	if (!res.ok) return null;
	const data = await res.json().catch(() => null);
	return data?.data ?? null;
}

// ── cache לפרסומות המאושרות ──
/** @type {{ at: number, ads: SubmittedAd[] }} */
let approvedCache = { at: 0, ads: [] };
function invalidateAds() {
	approvedCache.at = 0;
}

// ============================================================
// API ציבורי
// ============================================================

/**
 * ממתינות + נדחות יחד (כמו במקור בקהילה — ה-UI מסנן לפי status).
 * @returns {Promise<SubmittedAd[]>}
 */
export async function listPending() {
	const [pending, rejected] = await Promise.all([
		listByStatus('pending'),
		listByStatus('rejected')
	]);
	return [...pending, ...rejected];
}

/** @returns {Promise<SubmittedAd[]>} */
export async function listApproved() {
	if (Date.now() - approvedCache.at < TTL_ADS) return approvedCache.ads;
	let ads = /** @type {SubmittedAd[]} */ ([]);
	try {
		ads = await listByStatus('approved');
	} catch {
		/* שגיאה זמנית — סרגל הצד יציג רק את מודעות הרשת הסטטיות */
	}
	approvedCache = { at: Date.now(), ads };
	return ads;
}

/**
 * הפרסומות של מפרסם מסוים, בכל סטטוס — לאזור האישי. הסינון בשרת לפי המזהה
 * והאימייל שנשמרו בשליחה (submitted_by_*).
 * @param {{id?: string, email?: string}} owner
 * @returns {Promise<SubmittedAd[]>}
 */
export async function listAdsByOwner({ id, email }) {
	/** @type {string[]} */
	const or = [];
	if (id) or.push(`filters[$or][${or.length}][submitted_by_id][$eq]=${encodeURIComponent(id)}`);
	if (email)
		or.push(`filters[$or][${or.length}][submitted_by_email][$eqi]=${encodeURIComponent(email)}`);
	if (!or.length) return [];
	try {
		const qs = `${or.join('&')}&sort=submitted_at:desc&pagination[pageSize]=100`;
		const res = await api(`${ENDPOINT}?${qs}`);
		if (!res.ok) return [];
		const data = await res.json().catch(() => null);
		return (Array.isArray(data?.data) ? data.data : []).map(fromStrapi);
	} catch {
		return [];
	}
}

/** @param {string} id @returns {Promise<SubmittedAd|null>} */
export async function getAd(id) {
	const s = await findByDocumentId(id);
	return s ? fromStrapi(s) : null;
}

/**
 * שליחת פרסומת חדשה מהבילדר המקומי (ad_status: pending).
 * payment ו-requestedDurationDays נארזים בתוך ה-JSON של landing —
 * לאוסף המשותף עמודות מוקלדות ואי אפשר להוסיף שדות חדשים.
 * @param {{
 *   title: string,
 *   subtitle?: string,
 *   hoverText?: string,
 *   cta?: string,
 *   gradient?: string,
 *   logo?: string,
 *   mainImage?: string,
 *   mainImageFit?: unknown,
 *   landing?: any,
 *   submittedBy?: { id?: string, email?: string, name?: string },
 *   payment?: string,
 *   requestedDurationDays?: number
 * }} payload
 * @returns {Promise<SubmittedAd>}
 */
export async function submitAd(payload) {
	const landing = {
		...(payload.landing ?? emptyLanding()),
		_payment: payload.payment === 'code' ? 'code' : 'pending',
		_requestedDurationDays: Number(payload.requestedDurationDays) === 180 ? 180 : 30,
		// parseAdImageFit מנקה קלט לא-בטוח מהדפדפן לערכים חוקיים בלבד
		_mainImageFit: parseAdImageFit(payload.mainImageFit)
	};
	const res = await api(ENDPOINT, {
		method: 'POST',
		body: JSON.stringify({
			data: {
				ad_status: 'pending',
				title: payload.title,
				subtitle: payload.subtitle ?? '',
				hover_text: payload.hoverText ?? '',
				cta: payload.cta ?? '',
				gradient: payload.gradient ?? '',
				logo: payload.logo ?? '',
				main_image: payload.mainImage ?? '',
				landing,
				submitted_by_id: payload.submittedBy?.id ?? null,
				submitted_by_email: payload.submittedBy?.email ?? null,
				submitted_by_name: payload.submittedBy?.name ?? null,
				submitted_at: new Date().toISOString()
			}
		})
	});
	if (!res.ok) throw new Error(`strapi submitAd → ${res.status}`);
	invalidateAds();
	const data = await res.json();
	return fromStrapi(data.data);
}

/**
 * אישור ופרסום: קובע תאריך תפוגה לפי durationDays (ברירת מחדל 30 יום).
 * @param {string} id @param {string} decidedBy @param {number} [durationDays]
 * @returns {Promise<SubmittedAd|null>}
 */
export async function approveAd(id, decidedBy, durationDays) {
	const existing = await findByDocumentId(id);
	if (!existing) return null;
	// ברירת מחדל: התקופה שהמפרסם ביקש בשליחה (landing._requestedDurationDays)
	const requested =
		Number(existing.landing?._requestedDurationDays) === 180 ? 180 : DEFAULT_DURATION_DAYS;
	const days = durationDays ?? existing.duration_days ?? requested;
	const now = new Date();
	const expires = new Date(now.getTime() + days * DAY_MS);
	const res = await api(`${ENDPOINT}/${encodeURIComponent(id)}`, {
		method: 'PUT',
		body: JSON.stringify({
			data: {
				ad_status: 'approved',
				decided_at: now.toISOString(),
				decided_by: decidedBy,
				rejection_reason: null,
				duration_days: days,
				expires_at: expires.toISOString()
			}
		})
	});
	if (!res.ok) throw new Error(`strapi approveAd → ${res.status}`);
	invalidateAds();
	const data = await res.json();
	return fromStrapi(data.data);
}

/**
 * @param {string} id @param {string} decidedBy @param {string} [reason]
 * @returns {Promise<SubmittedAd|null>}
 */
export async function rejectAd(id, decidedBy, reason) {
	const existing = await findByDocumentId(id);
	if (!existing) return null;
	const res = await api(`${ENDPOINT}/${encodeURIComponent(id)}`, {
		method: 'PUT',
		body: JSON.stringify({
			data: {
				ad_status: 'rejected',
				decided_at: new Date().toISOString(),
				decided_by: decidedBy,
				rejection_reason: reason ?? null
			}
		})
	});
	if (!res.ok) throw new Error(`strapi rejectAd → ${res.status}`);
	invalidateAds();
	const data = await res.json();
	return fromStrapi(data.data);
}

/** החזרה לממתינות (מ-נדחתה או מ-פורסמה). @param {string} id @returns {Promise<SubmittedAd|null>} */
export async function backToPending(id) {
	const existing = await findByDocumentId(id);
	if (!existing) return null;
	const res = await api(`${ENDPOINT}/${encodeURIComponent(id)}`, {
		method: 'PUT',
		body: JSON.stringify({
			data: {
				ad_status: 'pending',
				decided_at: null,
				decided_by: null,
				rejection_reason: null
			}
		})
	});
	if (!res.ok) throw new Error(`strapi backToPending → ${res.status}`);
	invalidateAds();
	const data = await res.json();
	return fromStrapi(data.data);
}

/** מחיקה לצמיתות. @param {string} id @returns {Promise<boolean>} */
export async function removeAd(id) {
	const existing = await findByDocumentId(id);
	if (!existing) return false;
	const res = await api(`${ENDPOINT}/${encodeURIComponent(id)}`, { method: 'DELETE' });
	if (!res.ok && res.status !== 204) return false;
	invalidateAds();
	return true;
}

/**
 * עדכון שדות הכרטיס (עריכה בשורה בפאנל).
 * @param {string} id
 * @param {{title?:string,subtitle?:string,cta?:string,hoverText?:string}} fields
 * @returns {Promise<SubmittedAd|null>}
 */
export async function updateAdFields(id, fields) {
	/** @type {Record<string,string>} */
	const data = {};
	if (typeof fields.title === 'string') data.title = fields.title;
	if (typeof fields.subtitle === 'string') data.subtitle = fields.subtitle;
	if (typeof fields.cta === 'string') data.cta = fields.cta;
	if (typeof fields.hoverText === 'string') data.hover_text = fields.hoverText;
	if (Object.keys(data).length === 0) return null;

	const existing = await findByDocumentId(id);
	if (!existing) return null;
	const res = await api(`${ENDPOINT}/${encodeURIComponent(id)}`, {
		method: 'PUT',
		body: JSON.stringify({ data })
	});
	if (!res.ok) throw new Error(`strapi updateAdFields → ${res.status}`);
	invalidateAds();
	const out = await res.json();
	return fromStrapi(out.data);
}

// ----- סטטיסטיקות -----

/**
 * @returns {Promise<{pending:number,rejected:number,approved:number,approvedThisWeek:number,submittedThisWeek:number,total:number}>}
 */
export async function getAdsStats() {
	const [pending, rejected, approved] = await Promise.all([
		listByStatus('pending'),
		listByStatus('rejected'),
		listByStatus('approved')
	]);
	const weekAgo = Date.now() - 7 * DAY_MS;
	const submittedThisWeek = [...pending, ...rejected, ...approved].filter(
		(a) => new Date(a.submittedAt).getTime() >= weekAgo
	).length;
	const approvedThisWeek = approved.filter(
		(a) => a.decidedAt && new Date(a.decidedAt).getTime() >= weekAgo
	).length;
	return {
		pending: pending.length,
		rejected: rejected.length,
		approved: approved.length,
		approvedThisWeek,
		submittedThisWeek,
		total: pending.length + rejected.length + approved.length
	};
}

/** מונה הממתינות — לתג בפאנל הניהול. @returns {Promise<number>} */
export async function countPending() {
	try {
		const list = await listByStatus('pending');
		return list.length;
	} catch {
		return 0;
	}
}

// ============================================================
// תזמון ותאריכי פקיעה
// ============================================================

/**
 * @typedef {Object} AdSchedule
 * @property {string} id
 * @property {string} title
 * @property {string} advertiserName
 * @property {string} advertiserEmail
 * @property {string} publishedAt
 * @property {string} expiresAt
 * @property {number} durationDays
 * @property {number} daysLeft
 * @property {'expired'|'ending'|'active'} state ending = ≤7 ימים
 * @property {number} paymentAmount
 */

/** @param {SubmittedAd} ad @returns {AdSchedule|null} */
export function computeSchedule(ad) {
	if (ad.status !== 'approved' || !ad.decidedAt) return null;
	const days = ad.durationDays ?? DEFAULT_DURATION_DAYS;
	const publishedAt = ad.decidedAt;
	const expiresAt =
		ad.expiresAt ?? new Date(new Date(publishedAt).getTime() + days * DAY_MS).toISOString();
	const daysLeft = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / DAY_MS);
	/** @type {AdSchedule['state']} */
	const state = daysLeft < 0 ? 'expired' : daysLeft <= 7 ? 'ending' : 'active';
	return {
		id: ad.id,
		title: ad.title,
		advertiserName: ad.submittedBy?.name ?? ad.companyName ?? '-',
		advertiserEmail: ad.submittedBy?.email ?? '',
		publishedAt,
		expiresAt,
		durationDays: days,
		daysLeft,
		state,
		paymentAmount: ad.paymentAmount ?? 0
	};
}

/** @returns {Promise<AdSchedule[]>} */
export async function listSchedules() {
	const approved = await listByStatus('approved');
	return approved.map(computeSchedule).filter((s) => s !== null);
}

// ============================================================
// סיכומי מפרסמים — קיבוץ לפי email/id
// ============================================================

/**
 * @typedef {Object} AdvertiserSummary
 * @property {string} key email או id
 * @property {string} name
 * @property {string} email
 * @property {string} phone
 * @property {string} address
 * @property {string} companyName
 * @property {number} totalPaid
 * @property {number} adsCount
 * @property {number} activeCount
 * @property {string} firstSubmittedAt
 * @property {string} lastSubmittedAt
 * @property {boolean} isReturning יותר מפרסומת אחת
 */

/** @returns {Promise<AdvertiserSummary[]>} */
export async function listAdvertisers() {
	const [pending, approved, rejectedAll] = await Promise.all([
		listByStatus('pending'),
		listByStatus('approved'),
		listByStatus('rejected')
	]);
	const all = [...pending, ...approved, ...rejectedAll];
	/** @type {Map<string, AdvertiserSummary>} */
	const map = new Map();
	for (const ad of all) {
		const key = ad.submittedBy?.email || ad.submittedBy?.id || ad.id;
		const existing = map.get(key);
		const isActiveNow = ad.status === 'approved' && computeSchedule(ad)?.state !== 'expired';
		if (!existing) {
			map.set(key, {
				key,
				name: ad.submittedBy?.name ?? '',
				email: ad.submittedBy?.email ?? '',
				phone: ad.landing?.phone ?? '',
				address: ad.landing?.address ?? '',
				companyName: ad.companyName || ad.title || '',
				totalPaid: ad.paymentAmount ?? 0,
				adsCount: 1,
				activeCount: isActiveNow ? 1 : 0,
				firstSubmittedAt: ad.submittedAt,
				lastSubmittedAt: ad.submittedAt,
				isReturning: false
			});
		} else {
			existing.adsCount++;
			existing.activeCount += isActiveNow ? 1 : 0;
			existing.totalPaid += ad.paymentAmount ?? 0;
			if (!existing.name && ad.submittedBy?.name) existing.name = ad.submittedBy.name;
			if (!existing.phone && ad.landing?.phone) existing.phone = ad.landing.phone;
			if (!existing.address && ad.landing?.address) existing.address = ad.landing.address;
			if (!existing.companyName && (ad.companyName || ad.title))
				existing.companyName = ad.companyName || ad.title;
			if (new Date(ad.submittedAt) < new Date(existing.firstSubmittedAt))
				existing.firstSubmittedAt = ad.submittedAt;
			if (new Date(ad.submittedAt) > new Date(existing.lastSubmittedAt))
				existing.lastSubmittedAt = ad.submittedAt;
			existing.isReturning = existing.adsCount > 1;
		}
	}
	return Array.from(map.values()).sort((a, b) => b.totalPaid - a.totalPaid);
}
