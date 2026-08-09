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
import { parseAdStyle } from '$lib/adStyle';
import { AD_SLOT_COUNT } from '$lib/adSlots.js';

const STRAPI_URL = (env.STRAPI_URL || 'https://api.gofreeil.com').replace(/\/$/, '');
const TOKEN = env.STRAPI_TOKEN || '';
const ENDPOINT = '/api/submitted-ads';

// האוסף submitted-ads ב-Strapi משותף עם "קהילה בשכונה" ואין בו עמודת אתר,
// ולכן בלי הסימון הזה כל פרסומת שאושרה שם הופיעה גם כאן. הסימון נשמר
// ב-landing._site (עמודת json שכבר נושאת מפתחות פנימיים כמו _payment),
// כך שאין צורך בשינוי סכמה. פרסומת בלי _site היא פרסומת ישנה של
// "קהילה בשכונה" — היא לא שייכת לאתר הזה ולא מוצגת בו.
const SITE_ID = 'index';

/** האם הפרסומת הוגשה לאתר הזה. @param {any} s */
function belongsToThisSite(s) {
	return s?.landing?._site === SITE_ID;
}

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
 * @property {import('$lib/adStyle').AdStyle|null} adStyle העיצוב שנקבע בבילדר (לוגו, רצועה, כותרת); null = מודעה ותיקה
 * @property {any} landing
 * @property {string} payment "code" = סומן כשולם; "pending" = תשלום לתיאום. הגשה תמיד נכנסת כ-pending.
 * @property {boolean} codeRequested המפרסם הקליד את קוד הבעלים — בקשה לפרסום חינם שממתינה לאישור ידני
 * @property {number} requestedDurationDays התקופה שהמפרסם ביקש בשליחה (30/180) — ברירת המחדל באישור
 * @property {number|undefined} [order] מספר המקום בטור הפרסומות, 0-based (0 = מקום 1).
 *   המספר קבוע לפרסומת: הוא לא זז כשמאשרים פרסומות אחרות, ונשמר לה גם דרך
 *   השהיה ופקיעה. undefined = פרסומת ותיקה שטרם הוקצה לה מספר (מקבלת אחד
 *   בפעולת הניהול/האישור הבאה, לפי מקומה הנוכחי על האתר).
 * @property {boolean} [paused] מושהית — יורדת מהאתר ושומרת את הימים שנותרו
 * @property {number|undefined} [pausedDaysLeft] הימים ששמורים לה מרגע ההשהיה
 * @property {string} [replacesAdId] הפרסומת הקודמת של אותו מפרסם שהגרסה הזו באה להחליף
 * @property {string} [replacesTitle] כותרת אותה גרסה קודמת — כדי שהמנהל יראה מה מוחלף
 * @property {AdStatus|''} [replacesStatus] הסטטוס שלה בזמן השליחה (רק approved באמת מוחלפת)
 * @property {string} [supersededBy] מי החליפה אותה — פרסומת כזו היא היסטוריה
 * @property {string[]} [retiredPendingIds] רגעי: בקשות ממתינות שירדו מהתור בשליחה הזו
 * @property {string} [replacedNowTitle] רגעי: כותרת הפרסומת שירדה מהאתר באישור הזה
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
		// null במודעות שנשלחו לפני שהעיצוב נשמר — הצרכן נופל ל-legacyAdStyle
		adStyle: parseAdStyle(s.landing?._adStyle),
		payment: s.landing?._payment === 'code' ? 'code' : 'pending',
		// המפרסם הקליד את קוד הבעלים — בקשה לפרסום חינם, לא אישור שלה
		codeRequested: s.landing?._codeRequested === true,
		requestedDurationDays: Number(s.landing?._requestedDurationDays) === 180 ? 180 : 30,
		// מספר המקום בטור הפרסומות - נקבע במסך הניהול או בהקצאה באישור
		order: typeof s.landing?._order === 'number' ? s.landing._order : undefined,
		paused: s.landing?._paused === true,
		pausedDaysLeft:
			typeof s.landing?._pausedDaysLeft === 'number' ? s.landing._pausedDaysLeft : undefined,
		replacesAdId:
			typeof s.landing?._replacesAdId === 'string' ? s.landing._replacesAdId : undefined,
		replacesTitle:
			typeof s.landing?._replacesTitle === 'string' ? s.landing._replacesTitle : undefined,
		supersededBy:
			typeof s.landing?._supersededBy === 'string' ? s.landing._supersededBy : undefined
	};
}

/** @param {AdStatus} status @returns {Promise<SubmittedAd[]>} */
async function fetchByStatus(status) {
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
		// סינון לפי אתר: האוסף משותף, ובלי זה פרסומות של "קהילה בשכונה"
		// היו נכנסות לכאן. הסינון בקוד ולא ב-Strapi כי אין עמודה ייעודית.
		out.push(...items.filter(belongsToThisSite).map(fromStrapi));
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
	const item = data?.data ?? null;
	// גם בגישה ישירה לפי מזהה: פרסומת של אתר אחר באוסף המשותף אינה קיימת כאן
	return item && belongsToThisSite(item) ? item : null;
}

// ── cache לרשימות, לפי סטטוס ──
// חובה, לא אופטימיזציה: התמונות שמורות כ-base64 בתוך הרשומה (~700KB לפרסומת),
// וטעינה אחת של מסך הניהול קוראת לאותן רשימות חמש פעמים (רשימות, סטטיסטיקות,
// תזמון, מפרסמים). בלי ה-dedup הזה אותו מטען כבד נמשך שוב ושוב במקביל,
// הבקשות נכשלות ב-timeout והמסך נפתח ריק — בלי הפרסומת הממתינה ובלי
// כפתורי אשר/דחה.
const TTL_REVIEW = 15_000;
/** @type {Map<string, { at: number, ads: SubmittedAd[] }>} */
const listCache = new Map();
/** @type {Map<string, Promise<SubmittedAd[]>>} */
const listInflight = new Map();

function invalidateAds() {
	listCache.clear();
}

/** @param {AdStatus} status @returns {Promise<SubmittedAd[]>} */
function listByStatus(status) {
	const ttl = status === 'approved' ? TTL_ADS : TTL_REVIEW;
	const hit = listCache.get(status);
	if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.ads);
	const running = listInflight.get(status);
	if (running) return running;
	const p = fetchByStatus(status)
		.then((ads) => {
			listCache.set(status, { at: Date.now(), ads });
			listInflight.delete(status);
			return ads;
		})
		.catch((e) => {
			listInflight.delete(status);
			throw e;
		});
	listInflight.set(status, p);
	return p;
}

/** סדר התצוגה: קודם מי שקיבל מיקום ידני, אחריו החדשות ביותר.
 *  @param {SubmittedAd} a @param {SubmittedAd} b */
function byDisplayOrder(a, b) {
	const ao = a.order ?? Number.MAX_SAFE_INTEGER;
	const bo = b.order ?? Number.MAX_SAFE_INTEGER;
	if (ao !== bo) return ao - bo;
	return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
}

// ============================================================
// מפרסם חוזר: זיהוי גרסה מעודכנת של פרסומת קיימת
// ------------------------------------------------------------
// בבילדר אין "עריכה" של רשומה קיימת — מפרסם ששב לשפר את הפרסומת שלו
// שולח רשומה חדשה. בלי הקישור שכאן ההתראה למנהל נוסחה כבקשה חדשה,
// ואישור שלה הוסיף פרסומת שנייה לאותו מפרסם במקום להחליף את הישנה.
// ============================================================

/** טלפון ישראלי מנורמל להשוואה: ספרות בלבד, 972 → 0 @param {string|undefined|null} raw */
function normPhone(raw) {
	const digits = (raw ?? '').replace(/\D/g, '').replace(/^972/, '0');
	return digits.length >= 9 ? digits : '';
}

/** מפתחות הזהות של מפרסם — מזהה משתמש, אימייל, וטלפון מדף הנחיתה. @param {any} ad */
function identityKeys(ad) {
	/** @type {string[]} */
	const keys = [];
	if (ad?.submittedBy?.id) keys.push(`id:${ad.submittedBy.id}`);
	const email = (ad?.submittedBy?.email || ad?.landing?.email || '').trim().toLowerCase();
	if (email) keys.push(`email:${email}`);
	const phone = normPhone(ad?.landing?.phone);
	if (phone) keys.push(`phone:${phone}`);
	return keys;
}

/** @param {any} a @param {any} b */
function sameAdvertiser(a, b) {
	const keysB = new Set(identityKeys(b));
	return identityKeys(a).some((k) => keysB.has(k));
}

/** @param {SubmittedAd} a @param {SubmittedAd} b */
const byNewest = (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();

/**
 * מה כבר יש למפרסם הזה: target = הפרסומת שהשליחה החדשה היא גרסה מעודכנת
 * שלה (מאושרת → ממתינה → נדחתה), stalePending = כל בקשותיו הממתינות.
 * "נדחה, תיקן ושלח שוב" הוא המסלול הנפוץ ביותר ולכן גם נדחתה נספרת.
 * כשל כאן לא מפיל שליחה — מפרסם שלא זוהה מתנהג פשוט כמפרסם חדש.
 * @param {any} identity
 * @returns {Promise<{ target: SubmittedAd|null, stalePending: SubmittedAd[] }>}
 */
async function findPredecessors(identity) {
	/** @type {SubmittedAd[]} */
	let candidates;
	try {
		const [approved, pending, rejected] = await Promise.all([
			listByStatus('approved'),
			listByStatus('pending'),
			listByStatus('rejected')
		]);
		candidates = [...approved, ...pending, ...rejected];
	} catch (e) {
		console.warn('[adsStore] findPredecessors failed:', e instanceof Error ? e.message : e);
		return { target: null, stalePending: [] };
	}
	const mine = candidates.filter((a) => !a.supersededBy && sameAdvertiser(a, identity));
	const live = mine.filter((a) => a.status === 'approved').sort(byNewest);
	const stalePending = mine.filter((a) => a.status === 'pending').sort(byNewest);
	const past = mine.filter((a) => a.status === 'rejected').sort(byNewest);
	return { target: live[0] ?? stalePending[0] ?? past[0] ?? null, stalePending };
}

/**
 * כל הפרסומות המאושרות שחיות כרגע על האתר לאותו מפרסם - חוץ מזו שמאשרים
 * עכשיו. מפרסם מקבל משבצת אחת; שתי מודעות שלו זו לצד זו הן תמיד תקלה ולא
 * בחירה - מי שבאמת רוצה שתיים מאשר עם keepPrevious.
 * שגיאה כאן לא מפילה את האישור: במקרה הגרוע הישנות יישארו וירדו ידנית.
 * @param {SubmittedAd} current
 * @returns {Promise<SubmittedAd[]>}
 */
async function findLiveAdsOfAdvertiser(current) {
	try {
		const approved = await listByStatus('approved');
		return approved.filter((a) => a.id !== current.id && !a.supersededBy && sameAdvertiser(a, current));
	} catch (e) {
		console.warn('[adsStore] findLiveAdsOfAdvertiser failed:', e instanceof Error ? e.message : e);
		return [];
	}
}

/**
 * מוציא גרסה ישנה מהמחזור אחרי שגרסה מעודכנת נכנסה במקומה. הסטטוס
 * 'rejected' הוא הארכיון היחיד שיש בסכמה — הפרסומת יורדת מהאתר ומהתור
 * אבל נשארת בטאב "נדחו" עם הסיבה, ואפשר להחזיר אותה. שום דבר לא נמחק.
 * @param {SubmittedAd} old @param {string} newAdId @param {string} decidedBy @param {string} reason
 */
async function supersedeAd(old, newAdId, decidedBy, reason) {
	const res = await api(`${ENDPOINT}/${encodeURIComponent(old.id)}`, {
		method: 'PUT',
		body: JSON.stringify({
			data: {
				ad_status: 'rejected',
				decided_at: new Date().toISOString(),
				decided_by: decidedBy,
				rejection_reason: reason,
				landing: { ...(old.landing ?? {}), _supersededBy: newAdId }
			}
		})
	});
	if (!res.ok) throw new Error(`strapi supersedeAd → ${res.status}`);
	invalidateAds();
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
	let ads = /** @type {SubmittedAd[]} */ ([]);
	try {
		ads = await listByStatus('approved');
	} catch {
		/* שגיאה זמנית — סרגל הצד יציג רק את מודעות הרשת הסטטיות */
	}
	// עותק לפני מיון — המערך עצמו יושב ב-cache ומשותף לכל הקוראים
	return [...ads].sort(byDisplayOrder);
}

/** האם הפרסומת אמורה להיות מוצגת לגולש עכשיו @param {SubmittedAd} ad @param {number} now */
function isLiveNow(ad, now) {
	if (ad.paused) return false;
	if (!ad.expiresAt) return true;
	const t = new Date(ad.expiresAt).getTime();
	return !Number.isFinite(t) || t > now;
}

/**
 * מה שהאתר עצמו מציג: מאושרות שאינן מושהות ושתוקפן לא פג. בלי הסינון
 * הזה תאריך הפקיעה היה מספר בלבד — פרסומת "פגה" המשיכה להופיע בטור.
 * @returns {Promise<SubmittedAd[]>}
 */
export async function listApprovedLive() {
	const now = Date.now();
	return (await listApproved()).filter((a) => isLiveNow(a, now));
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
 *   adStyle?: unknown,
 *   landing?: any,
 *   submittedBy?: { id?: string, email?: string, name?: string },
 *   payment?: string,
 *   requestedDurationDays?: number
 * }} payload
 * @returns {Promise<SubmittedAd>}
 */
export async function submitAd(payload) {
	// מפרסם חוזר: מחפשים לפני היצירה, כדי שהרשומה החדשה עצמה לא תיספר
	const { target: predecessor, stalePending } = await findPredecessors(payload);
	const landing = {
		...(payload.landing ?? emptyLanding()),
		// הגשה לעולם לא נכנסת כ"שולם". קוד הבעלים הוא *בקשה* לפרסום חינם,
		// והזכות עצמה ניתנת רק באישור הידני של האדמין.
		_payment: 'pending',
		_codeRequested: payload.payment === 'code',
		_requestedDurationDays: Number(payload.requestedDurationDays) === 180 ? 180 : 30,
		// parseAdImageFit מנקה קלט לא-בטוח מהדפדפן לערכים חוקיים בלבד
		_mainImageFit: parseAdImageFit(payload.mainImageFit),
		// העיצוב שהמפרסם קבע בבילדר (לוגו, רצועה, כותרת) — בלעדיו הפרסומת
		// מתפרסמת עם ברירות המחדל של האתר ולא עם מה שהוא ראה על המסך
		_adStyle: parseAdStyle(payload.adStyle),
		// שיוך לאתר — בלעדיו הפרסומת תיבלע באוסף המשותף ותופיע גם באתרים אחרים
		_site: SITE_ID,
		// קישור לגרסה הקודמת של אותו מפרסם: ההתראה מדברת על עדכון,
		// והאישור מחליף את הישנה במקום להוסיף פרסומת שנייה לידה
		...(predecessor ? { _replacesAdId: predecessor.id, _replacesTitle: predecessor.title } : {})
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
	const ad = fromStrapi(data.data);
	// לא נשענים על מה ש-Strapi מחזיר ב-POST: אם עמודת ה-json לא הוחזרה,
	// ההתראה למנהל הייתה מנוסחת בטעות כבקשה חדשה במקום כעדכון
	if (predecessor) {
		ad.replacesAdId = predecessor.id;
		ad.replacesTitle = predecessor.title;
		ad.replacesStatus = predecessor.status;
	}

	// בקשות ממתינות קודמות של אותו מפרסם יורדות מהתור: המנהל אמור לראות
	// בקשה אחת לכל מפרסם — האחרונה — ולא שתי בקשות שנראות כפולות.
	// מאושרת קודמת נשארת חיה עד שהחדשה תאושר, אחרת האתר נשאר בלי פרסומת.
	/** @type {string[]} */
	const retired = [];
	for (const stale of stalePending) {
		try {
			await supersedeAd(stale, ad.id, 'system', 'הוחלפה בגרסה מעודכנת שהמפרסם שלח');
			retired.push(stale.id);
		} catch (e) {
			console.warn('[adsStore] retire pending predecessor failed:', e instanceof Error ? e.message : e);
		}
	}
	if (retired.length > 0) ad.retiredPendingIds = retired;
	return ad;
}

/**
 * אישור ופרסום: קובע תאריך תפוגה לפי durationDays (ברירת מחדל 30 יום).
 * @param {string} id @param {string} decidedBy @param {number} [durationDays]
 * @param {{keepPrevious?: boolean}} [opts] keepPrevious = אשר כפרסומת נוספת
 *        ואל תוריד את הקודמת (מפרסם שבאמת רוצה שתיים במקביל)
 * @returns {Promise<SubmittedAd|null>}
 */
export async function approveAd(id, decidedBy, durationDays, opts = {}) {
	const existing = await findByDocumentId(id);
	if (!existing) return null;
	const current = fromStrapi(existing);

	// גרסה מעודכנת של מפרסם קיים נכנסת *במקום* הישנה: אותו מקום בטור
	// ואותו תאריך סיום, ומיד אחרי האישור הישנה יורדת מהאתר. בלי זה
	// האישור היה מוסיף פרסומת שנייה לאותו מפרסם, ליד הישנה.
	const predecessor =
		current.replacesAdId && !opts.keepPrevious ? await getAd(current.replacesAdId).catch(() => null) : null;

	// כל מה שחי כרגע לאותו מפרסם: _replacesAdId מצביע על מה שהיה חי *בזמן
	// השליחה* בלבד. כששתי גרסאות היו באוויר, האישור הוריד את הישנה, השאיר
	// את השנייה ודחף אותה למטה. מפרסם מקבל משבצת אחת, ולכן ברירת המחדל
	// היא שהחדשה מכסה את כולן.
	const liveBefore = opts.keepPrevious ? [] : await findLiveAdsOfAdvertiser(current);
	const replacingAll =
		predecessor && predecessor.status === 'approved' && !predecessor.supersededBy &&
		!liveBefore.some((a) => a.id === predecessor.id)
			? [predecessor, ...liveBefore]
			: liveBefore;
	// הכי חדשה מביניהן היא זו שהחדשה יורשת ממנה את המשבצת בטור
	const replacing = [...replacingAll].sort(byNewest)[0] ?? null;

	// ברירת מחדל: התקופה שהמפרסם ביקש בשליחה (landing._requestedDurationDays)
	const requested =
		Number(existing.landing?._requestedDurationDays) === 180 ? 180 : DEFAULT_DURATION_DAYS;
	const now = new Date();
	// התקופה שהמפרסם כבר שילם עליה ממשיכה כרגיל: אותו תאריך פקיעה, לא
	// ספירה חדשה. מבין כמה גרסאות שיורדות - הרחוקה ביותר, שלא לגזול
	// זמן ששולם עליו.
	const inheritedExpiry =
		replacingAll
			.filter((a) => !a.paused && a.expiresAt && new Date(a.expiresAt).getTime() > now.getTime())
			.map((a) => a.expiresAt)
			.sort()
			.pop() ?? null;
	const days =
		durationDays ?? existing.duration_days ??
		(inheritedExpiry ? (replacing?.durationDays ?? requested) : requested);
	const expires = inheritedExpiry ?? new Date(now.getTime() + days * DAY_MS).toISOString();

	// ----- מספר המקום בטור (1..12) -----
	// ברירת המחדל: פרסומת חדשה תופסת את המספר הפנוי הנמוך ביותר ואף אחת
	// לא זזה ממקומה. גרסה מחליפה יורשת את המספר של הישנה; פרסומת שהורדה
	// ואושרה מחדש חוזרת למקומה הקודם אם הוא עדיין פנוי.
	/** @type {number|undefined} */
	let slot;
	try {
		const approvedNow = (await listByStatus('approved')).filter((a) => a.id !== id);
		const slots = await ensureSlotsPersisted(approvedNow);
		const taken = new Set(slots.values());
		const inherited = replacing ? slots.get(replacing.id) : undefined;
		if (inherited !== undefined) {
			slot = inherited;
		} else if (typeof current.order === 'number' && current.order >= 0 && !taken.has(current.order)) {
			slot = current.order;
		} else {
			slot = 0;
			while (taken.has(slot)) slot++;
		}
	} catch (e) {
		// כשל בהקצאה לא מפיל אישור - הפרסומת תקבל מספר בפעולת הניהול הבאה
		console.warn('[adsStore] slot assignment failed:', e instanceof Error ? e.message : e);
		slot = typeof current.order === 'number' && current.order >= 0 ? current.order : undefined;
	}

	/** @type {Record<string, any>} */
	const payload = {
		ad_status: 'approved',
		decided_at: now.toISOString(),
		decided_by: decidedBy,
		rejection_reason: null,
		duration_days: days,
		expires_at: expires
	};
	if (slot !== undefined) {
		const landing = { ...(current.landing ?? {}), _order: slot };
		// פרסומת שמאושרת עכשיו היא בהגדרה לא "גרסה ישנה שהוחלפה". דגל
		// _supersededBy שנשאר מגלגול קודם גרם לפרסומת חיה להיראות מוחלפת:
		// גרסה מעודכנת של המפרסם לא זיהתה אותה ולא הורידה אותה באישור.
		delete landing._supersededBy;
		payload.landing = landing;
	}
	const res = await api(`${ENDPOINT}/${encodeURIComponent(id)}`, {
		method: 'PUT',
		body: JSON.stringify({ data: payload })
	});
	if (!res.ok) throw new Error(`strapi approveAd → ${res.status}`);
	invalidateAds();
	const data = await res.json();
	const approved = fromStrapi(data.data);

	// סדר הפעולות מכוון: קודם החדשה עולה, רק אחר-כך הישנות יורדות. כשל
	// כאן משאיר אותן באוויר (מצב שהמנהל רואה ומתקן) — עדיף מלהוריד את
	// הישנה ואז להיכשל בהעלאת החדשה ולהשאיר את המפרסם בלי פרסומת.
	const retiredTitles = [];
	for (const old of replacingAll) {
		try {
			await supersedeAd(old, id, decidedBy, 'הוחלפה בגרסה מעודכנת שאישרת');
			retiredTitles.push(old.title);
		} catch (e) {
			console.warn('[adsStore] supersede on approve failed:', e instanceof Error ? e.message : e);
		}
	}
	if (retiredTitles.length > 0) approved.replacedNowTitle = retiredTitles.join('", "');
	return approved;
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
	/** @type {Record<string, any>} */
	const patch = {
		ad_status: 'pending',
		decided_at: null,
		decided_by: null,
		rejection_reason: null
	};
	// פרסומת שירדה כי גרסה מעודכנת נכנסה במקומה, והמנהל מחזיר אותה בכוונה:
	// מסירים את סימון ההחלפה כדי שתתנהג שוב כבקשה ממתינה רגילה
	if (existing.landing?._supersededBy != null) {
		const landing = { ...existing.landing };
		delete landing._supersededBy;
		patch.landing = landing;
	}
	const res = await api(`${ENDPOINT}/${encodeURIComponent(id)}`, {
		method: 'PUT',
		body: JSON.stringify({ data: patch })
	});
	if (!res.ok) throw new Error(`strapi backToPending → ${res.status}`);
	invalidateAds();
	const data = await res.json();
	return fromStrapi(data.data);
}

// ----- מקומות ממוספרים בטור הפרסומות (1..12) -----

/**
 * כותב מספר מקום לפרסומת. המספר נשמר ב-landing._order — אותה עמודת json
 * שכבר נושאת מפתחות פנימיים (_site, _payment), כדי לא לשנות סכמה ב-Strapi.
 * שולחים את כל אובייקט ה-landing כי Strapi מחליף עמודת json במלואה,
 * ומפתח חסר היה נמחק.
 * @param {SubmittedAd} ad @param {number} order
 */
async function writeOrder(ad, order) {
	const res = await api(`${ENDPOINT}/${encodeURIComponent(ad.id)}`, {
		method: 'PUT',
		body: JSON.stringify({ data: { landing: { ...(ad.landing ?? {}), _order: order } } })
	});
	if (!res.ok) throw new Error(`strapi writeOrder → ${res.status}`);
}

/**
 * המספר האפקטיבי של כל פרסומת ברשימה (0-based). מי שכבר נקבע לה מספר —
 * שומרת עליו (בהתנגשות, הראשונה בסדר התצוגה גוברת); מי שאין לה מקבלת את
 * המספר הפנוי הנמוך ביותר, לפי סדר התצוגה הנוכחי. כך פרסומות ותיקות בלי
 * מספר מקבלות בדיוק את מקומן של היום — ההקצאה הראשונה לא מזיזה כלום.
 * @param {SubmittedAd[]} list @returns {Map<string, number>}
 */
function computeSlots(list) {
	/** @type {Map<string, number>} */
	const bySlot = new Map();
	/** @type {Set<number>} */
	const taken = new Set();
	const display = [...list].sort(byDisplayOrder);
	for (const ad of display) {
		if (typeof ad.order === 'number' && ad.order >= 0 && !taken.has(ad.order)) {
			bySlot.set(ad.id, ad.order);
			taken.add(ad.order);
		}
	}
	let next = 0;
	for (const ad of display) {
		if (bySlot.has(ad.id)) continue;
		while (taken.has(next)) next++;
		bySlot.set(ad.id, next);
		taken.add(next);
	}
	return bySlot;
}

/**
 * מספרי המקומות לתצוגה (1-based) — לדפי שרת שמציגים "מקום N מתוך 12".
 * @param {SubmittedAd[]} list @returns {Map<string, number>}
 */
export function computeAdSlots(list) {
	return new Map([...computeSlots(list)].map(([id, s]) => [id, s + 1]));
}

/**
 * מקבע ב-Strapi מספר מקום לכל פרסומת ברשימה שעדיין אין לה (או שהמספר
 * השמור מתנגש). כותב רק את מי שהשתנה — בהקצאה הראשונה זו כל הרשימה,
 * ומכאן והלאה כלום. רץ בפעולות ניהול בלבד, לא בנתיבי קריאה.
 * @param {SubmittedAd[]} list @returns {Promise<Map<string, number>>}
 */
async function ensureSlotsPersisted(list) {
	const slots = computeSlots(list);
	const dirty = list.filter((ad) => ad.order !== slots.get(ad.id));
	if (dirty.length > 0) {
		await Promise.all(
			dirty.map((ad) => writeOrder(ad, /** @type {number} */ (slots.get(ad.id))))
		);
		invalidateAds();
	}
	return slots;
}

/**
 * מזיזה פרסומת מאושרת מקום אחד למעלה/למטה: מחליפה מספרים עם השכנה
 * בסדר התצוגה. שאר הפרסומות לא זזות.
 * מחזירה null אם הפרסומת לא נמצאה או שהיא כבר בקצה הרשימה.
 * @param {string} id @param {'up'|'down'} direction
 * @returns {Promise<{title:string,position:number,total:number}|null>}
 */
export async function moveApprovedAd(id, direction) {
	const list = await listApproved();
	const slots = await ensureSlotsPersisted(list);
	const sorted = [...list].sort((a, b) => (slots.get(a.id) ?? 0) - (slots.get(b.id) ?? 0));
	const from = sorted.findIndex((a) => a.id === id);
	if (from === -1) return null;
	const to = direction === 'up' ? from - 1 : from + 1;
	if (to < 0 || to >= sorted.length) return null;

	const moved = sorted[from];
	const other = sorted[to];
	const movedSlot = /** @type {number} */ (slots.get(moved.id));
	const otherSlot = /** @type {number} */ (slots.get(other.id));
	await Promise.all([writeOrder(moved, otherSlot), writeOrder(other, movedSlot)]);
	invalidateAds();
	return { title: moved.title, position: otherSlot + 1, total: AD_SLOT_COUNT };
}

/**
 * מציב פרסומת מאושרת במקום מספרי מסוים בטור (1..12). מקום תפוס — השתיים
 * מתחלפות זו בזו; שאר הפרסומות לא זזות. המספר נשאר קבוע לפרסומת גם דרך
 * השהיה ופקיעה — כשהיא חוזרת לאוויר היא חוזרת לאותו מקום.
 * @param {string} id @param {number} requested
 * @returns {Promise<{title:string,slot:number,swappedTitle?:string,swappedSlot?:number}|null>}
 */
export async function setAdSlot(id, requested) {
	const n = Math.round(Number(requested));
	if (!Number.isFinite(n)) return null;
	const target = Math.min(AD_SLOT_COUNT, Math.max(1, n)) - 1;

	const list = await listApproved();
	const ad = list.find((a) => a.id === id);
	if (!ad) return null;
	const slots = await ensureSlotsPersisted(list);
	const cur = slots.get(id) ?? 0;
	if (cur === target) return { title: ad.title, slot: target + 1 };

	const occupant = list.find((a) => a.id !== id && slots.get(a.id) === target) ?? null;
	await Promise.all([writeOrder(ad, target), ...(occupant ? [writeOrder(occupant, cur)] : [])]);
	invalidateAds();
	return {
		title: ad.title,
		slot: target + 1,
		...(occupant ? { swappedTitle: occupant.title, swappedSlot: cur + 1 } : {})
	};
}

// ----- ניהול תקופת הפרסום: קציבה, השהיה, המשך -----

const MIN_DURATION_DAYS = 1;
const MAX_DURATION_DAYS = 730;

/** מנרמל קלט ימים מהטופס לטווח שפוי. @param {unknown} raw @returns {number} */
export function normalizeDurationDays(raw) {
	const n = Math.round(Number(raw));
	if (!Number.isFinite(n)) return DEFAULT_DURATION_DAYS;
	return Math.min(MAX_DURATION_DAYS, Math.max(MIN_DURATION_DAYS, n));
}

/**
 * קוצב לפרסומת תקופה חדשה. התקופה נספרת מיום הפרסום, ולכן קציבה קצרה
 * מהזמן שכבר רץ מורידה את הפרסומת מהאתר מיד — וזו המשמעות של "לקצוב".
 * @param {string} id @param {number} days
 * @returns {Promise<{title:string,expiresAt:string,daysLeft:number}|null>}
 */
export async function setAdDuration(id, days) {
	const existing = await findByDocumentId(id);
	if (!existing) return null;
	const from = existing.decided_at ?? existing.submitted_at ?? existing.createdAt ?? new Date().toISOString();
	const expires = new Date(new Date(from).getTime() + days * DAY_MS);
	const res = await api(`${ENDPOINT}/${encodeURIComponent(id)}`, {
		method: 'PUT',
		body: JSON.stringify({
			data: { duration_days: days, expires_at: expires.toISOString() }
		})
	});
	if (!res.ok) throw new Error(`strapi setAdDuration → ${res.status}`);
	invalidateAds();
	const out = await res.json();
	return {
		title: fromStrapi(out.data).title,
		expiresAt: expires.toISOString(),
		daysLeft: Math.ceil((expires.getTime() - Date.now()) / DAY_MS)
	};
}

/**
 * השהיה: הפרסומת יורדת מהאתר אבל שומרת את הימים שנותרו לה. בשונה
 * מ"החזר לממתינות" — המפרסם לא מפסיד ימים ששילם עליהם.
 * @param {string} id @returns {Promise<{title:string,daysLeft:number}|null>}
 */
export async function pauseAd(id) {
	const existing = await findByDocumentId(id);
	if (!existing) return null;
	const ad = fromStrapi(existing);
	if (ad.paused) return { title: ad.title, daysLeft: ad.pausedDaysLeft ?? 0 };
	const daysLeft = ad.expiresAt
		? Math.max(0, Math.ceil((new Date(ad.expiresAt).getTime() - Date.now()) / DAY_MS))
		: (ad.durationDays ?? DEFAULT_DURATION_DAYS);
	const res = await api(`${ENDPOINT}/${encodeURIComponent(id)}`, {
		method: 'PUT',
		body: JSON.stringify({
			data: { landing: { ...(ad.landing ?? {}), _paused: true, _pausedDaysLeft: daysLeft } }
		})
	});
	if (!res.ok) throw new Error(`strapi pauseAd → ${res.status}`);
	invalidateAds();
	return { title: ad.title, daysLeft };
}

/**
 * המשך אחרי השהיה: הימים שנשמרו נספרים מחדש מהיום.
 * @param {string} id @returns {Promise<{title:string,expiresAt:string,daysLeft:number}|null>}
 */
export async function resumeAd(id) {
	const existing = await findByDocumentId(id);
	if (!existing) return null;
	const ad = fromStrapi(existing);
	const daysLeft = ad.pausedDaysLeft ?? ad.durationDays ?? DEFAULT_DURATION_DAYS;
	const expires = new Date(Date.now() + daysLeft * DAY_MS);
	const landing = { ...(ad.landing ?? {}) };
	delete landing._paused;
	delete landing._pausedDaysLeft;
	const res = await api(`${ENDPOINT}/${encodeURIComponent(id)}`, {
		method: 'PUT',
		body: JSON.stringify({ data: { landing, expires_at: expires.toISOString() } })
	});
	if (!res.ok) throw new Error(`strapi resumeAd → ${res.status}`);
	invalidateAds();
	return { title: ad.title, expiresAt: expires.toISOString(), daysLeft };
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
 * @property {'expired'|'ending'|'active'|'paused'} state ending = ≤7 ימים
 * @property {number} paymentAmount
 * @property {number} [slot] מספר המקום בטור הפרסומות (1..12) — מוזן ב-listSchedules
 */

/** @param {SubmittedAd} ad @returns {AdSchedule|null} */
export function computeSchedule(ad) {
	if (ad.status !== 'approved' || !ad.decidedAt) return null;
	const days = ad.durationDays ?? DEFAULT_DURATION_DAYS;
	const publishedAt = ad.decidedAt;
	const expiresAt =
		ad.expiresAt ?? new Date(new Date(publishedAt).getTime() + days * DAY_MS).toISOString();
	// מושהית: הזמן לא רץ. הימים שנותרו הם אלה שנשמרו ברגע ההשהיה.
	const daysLeft = ad.paused
		? (ad.pausedDaysLeft ?? days)
		: Math.ceil((new Date(expiresAt).getTime() - Date.now()) / DAY_MS);
	/** @type {AdSchedule['state']} */
	const state = ad.paused
		? 'paused'
		: daysLeft < 0
			? 'expired'
			: daysLeft <= 7
				? 'ending'
				: 'active';
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
	// המספר האפקטיבי מחושב בזיכרון בלבד — נתיב קריאה לא כותב ל-Strapi
	const slots = computeSlots(approved);
	return approved
		.map((ad) => {
			const s = computeSchedule(ad);
			if (s) s.slot = (slots.get(ad.id) ?? 0) + 1;
			return s;
		})
		.filter((s) => s !== null)
		.sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
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
