// ============================================================
// visitorStats.js — נתוני Google Analytics בעומס אפסי
// פורט מ-national-gemach/src/lib/server/visitorStats.ts אל index.
//
// עיקרון: קריאה ל-GA מתבצעת רק מצד-האדמין (כניסה ל-/admin או ל-/profile
// של אדמין) ולכל היותר אחת ל-15 דקות, או מה-Cron. גולש רגיל לא מייצר
// אף קריאה ל-GA — המונה שהוא רואה נקרא מהמטמון ב-Strapi (configStore).
//
// דרוש (משתני סביבה בשרת — service account אחד יכול לשמש את כל האתרים):
//   GA_PROPERTY_ID        מזהה ה-Property המספרי של GA4 (לא G-XXXX)
//   GA_HOSTNAME           הדומיין של האתר הזה (ברירת מחדל index.gofreeil.com)
//   GA_SA_JSON            קובץ ה-JSON של ה-service account (או שני המשתנים הבאים)
//   GA_SA_CLIENT_EMAIL    האימייל של ה-service account
//   GA_SA_PRIVATE_KEY     המפתח הפרטי (עם \n או שורות ממש)
//
// כשאין הגדרות — כל הפונקציות מחזירות null, והמסכים מציגים "לא זמין"
// במקום ליפול.
// ============================================================

import { createSign } from 'crypto';
import { env } from '$env/dynamic/private';
import { getConfigValue, setConfigValue } from './configStore.js';

const PROPERTY_ID = (env.GA_PROPERTY_ID ?? '').trim();
// הנכס ב-GA משותף לכמה אתרים של יוצאים לחירות; מסננים לפי הדומיין
// כדי שהאינדקס יספור רק את עצמו.
const HOSTNAME = (env.GA_HOSTNAME ?? 'index.gofreeil.com').trim();

/** @returns {{clientEmail: string, privateKey: string} | null} */
function loadCredentials() {
	const rawJson = (env.GA_SA_JSON ?? '').trim();
	if (rawJson) {
		try {
			const j = JSON.parse(rawJson);
			if (j.client_email && j.private_key) {
				return { clientEmail: j.client_email, privateKey: j.private_key };
			}
		} catch (e) {
			console.error('[visitorStats] GA_SA_JSON parse failed:', e);
		}
	}
	const clientEmail = (env.GA_SA_CLIENT_EMAIL ?? '').trim();
	// תומך גם במפתח עם \n מילוליים וגם בשורות אמיתיות
	const privateKey = (env.GA_SA_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
	if (clientEmail && privateKey) return { clientEmail, privateKey };
	return null;
}

/** האם GA מוגדר בכלל — המסכים משתמשים בזה כדי להציג הנחיית התקנה */
export function gaConfigured() {
	return Boolean(PROPERTY_ID && loadCredentials());
}

const REFRESH_MS = 15 * 60 * 1000; // 15 דק' בין רענוני המונה
const STALE_MS = 30 * 24 * 60 * 60 * 1000; // מעבר לכך — ישן מדי, מחזירים null
const LABEL = 'צפיות החודש';
const METRIC = 'screenPageViews';

/**
 * @typedef {Object} VisitorStat
 * @property {number} count
 * @property {number} updatedAt
 * @property {string} [label]
 * @property {string} [metric]
 */

let refreshing = false;
/** @type {{ token: string, exp: number } | null} */
let tokenCache = null;

/** @param {Buffer|string} buf */
function b64url(buf) {
	return (typeof buf === 'string' ? Buffer.from(buf) : buf)
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

/** @returns {Promise<string|null>} */
async function getAccessToken() {
	const creds = loadCredentials();
	if (!creds) return null;
	if (tokenCache && Date.now() < tokenCache.exp - 60_000) return tokenCache.token;

	const now = Math.floor(Date.now() / 1000);
	const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
	const claim = b64url(
		JSON.stringify({
			iss: creds.clientEmail,
			scope: 'https://www.googleapis.com/auth/analytics.readonly',
			aud: 'https://oauth2.googleapis.com/token',
			iat: now,
			exp: now + 3600
		})
	);
	const signingInput = `${header}.${claim}`;

	let signature;
	try {
		const signer = createSign('RSA-SHA256');
		signer.update(signingInput);
		signature = b64url(signer.sign(creds.privateKey));
	} catch (e) {
		console.error('[visitorStats] JWT sign failed (GA_SA_PRIVATE_KEY שגוי?):', e);
		return null;
	}

	try {
		const res = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
				assertion: `${signingInput}.${signature}`
			})
		});
		if (!res.ok) {
			console.error('[visitorStats] token exchange failed:', res.status, await res.text());
			return null;
		}
		const j = await res.json();
		if (!j.access_token) return null;
		tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
		return j.access_token;
	} catch (e) {
		console.error('[visitorStats] token request error:', e);
		return null;
	}
}

/** מסנן hostName — הנכס ב-GA משותף לכמה אתרים */
function hostFilter() {
	return HOSTNAME
		? { filter: { fieldName: 'hostName', stringFilter: { matchType: 'EXACT', value: HOSTNAME } } }
		: null;
}

/** תחילת החודש הלועזי הנוכחי (YYYY-MM-01) לפי שעון ישראל */
function monthStartDate() {
	const ym = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Jerusalem',
		year: 'numeric',
		month: '2-digit'
	}).format(new Date());
	return `${ym}-01`;
}

/** @param {string} path @param {any} body @returns {Promise<any|null>} */
async function gaFetch(path, body) {
	if (!PROPERTY_ID) return null;
	const token = await getAccessToken();
	if (!token) return null;
	try {
		const res = await fetch(
			`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:${path}`,
			{
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			}
		);
		if (!res.ok) {
			console.error(`[visitorStats] ${path} failed:`, res.status, await res.text());
			return null;
		}
		return await res.json();
	} catch (e) {
		console.error(`[visitorStats] ${path} error:`, e);
		return null;
	}
}

/** צפיות מתחילת החודש. @returns {Promise<number|null>} */
async function fetchFromGA() {
	const filter = hostFilter();
	const j = await gaFetch('runReport', {
		dateRanges: [{ startDate: monthStartDate(), endDate: 'today' }],
		metrics: [{ name: METRIC }],
		...(filter ? { dimensionFilter: filter } : {})
	});
	if (!j) return null;
	const raw = j.rows?.[0]?.metricValues?.[0]?.value;
	// אין שורות = אין תנועה = 0 (נתון תקין, נשמר)
	if (raw === undefined) return 0;
	const n = Number(raw);
	return isNaN(n) ? null : n;
}

/**
 * מרענן את המונה מ-GA אם עברו 15 דקות. נקרא מצד-האדמין ומה-Cron בלבד.
 * @param {boolean} [force]
 */
export async function refreshVisitorStatsIfStale(force = false) {
	if (!gaConfigured()) return;
	if (refreshing) return;

	const cur = /** @type {VisitorStat|undefined} */ (await getConfigValue('visitors'));
	// label/metric שונים = שינוי מדד בקוד — מרעננים מיד ולא מחכים ל-TTL
	if (
		!force &&
		cur?.updatedAt &&
		cur.label === LABEL &&
		cur.metric === METRIC &&
		Date.now() - cur.updatedAt < REFRESH_MS
	) {
		return;
	}

	refreshing = true;
	try {
		const count = await fetchFromGA();
		if (count !== null) {
			await setConfigValue('visitors', {
				count,
				updatedAt: Date.now(),
				label: LABEL,
				metric: METRIC
			});
		}
	} finally {
		refreshing = false;
	}
}

/**
 * המונה השמור, בלי קריאה ל-GA. null אם אין נתון או שהוא ישן מדי.
 * @returns {Promise<{count:number,label:string}|null>}
 */
export async function getVisitorCount() {
	try {
		const cur = /** @type {VisitorStat|undefined} */ (await getConfigValue('visitors'));
		if (
			cur &&
			typeof cur.count === 'number' &&
			cur.updatedAt &&
			Date.now() - cur.updatedAt < STALE_MS
		) {
			return { count: cur.count, label: cur.label ?? LABEL };
		}
	} catch {
		/* fallback */
	}
	return null;
}

// ------------------------------------------------------------
// פירוט חודשי — למסך /admin/stats ולכרטיס שבאזור האישי.
// קריאת GA אחת לכל היותר בשעה, עם מטמון ב-config שמוגש גם אם GA נופל.
// ------------------------------------------------------------

/**
 * @typedef {Object} MonthlyStat
 * @property {string} yearMonth YYYYMM כפי שמוחזר מ-GA
 * @property {number} visitors
 * @property {number} pageViews
 */

const MONTHLY_REFRESH_MS = 60 * 60 * 1000;

/** @returns {Promise<{rows: MonthlyStat[], updatedAt: number}|null>} */
export async function getMonthlyVisitorStats() {
	const cached = /** @type {{rows:MonthlyStat[],updatedAt:number}|undefined} */ (
		await getConfigValue('visitors_monthly').catch(() => undefined)
	);
	if (cached?.rows && Date.now() - cached.updatedAt < MONTHLY_REFRESH_MS) return cached;

	const rows = await fetchMonthlyFromGA();
	if (rows) {
		const value = { rows, updatedAt: Date.now() };
		await setConfigValue('visitors_monthly', value);
		return value;
	}
	return cached?.rows ? cached : null;
}

/** @returns {Promise<MonthlyStat[]|null>} */
async function fetchMonthlyFromGA() {
	const filter = hostFilter();
	const j = await gaFetch('runReport', {
		dateRanges: [{ startDate: '365daysAgo', endDate: 'today' }],
		dimensions: [{ name: 'yearMonth' }],
		metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
		orderBys: [{ dimension: { dimensionName: 'yearMonth' } }],
		...(filter ? { dimensionFilter: filter } : {})
	});
	if (!j) return null;
	return (j.rows ?? [])
		.map((/** @type {any} */ r) => ({
			yearMonth: r.dimensionValues?.[0]?.value ?? '',
			visitors: Number(r.metricValues?.[0]?.value) || 0,
			pageViews: Number(r.metricValues?.[1]?.value) || 0
		}))
		.filter((/** @type {MonthlyStat} */ r) => /^\d{6}$/.test(r.yearMonth));
}

// ------------------------------------------------------------
// תובנות שנתיות — דפי עסקים נצפים, ערי הגולשים, מכשירים ומקורות תנועה.
// batchRunReports אחד (4 דוחות בקריאה אחת), מטמון שעה.
// ------------------------------------------------------------

/**
 * @typedef {Object} RankRow
 * @property {string} key
 * @property {number} count
 */

/**
 * @typedef {Object} YearlyInsights
 * @property {RankRow[]} businessPages נתיבי /business/{id} — ההמרה לשמות נעשית בדף
 * @property {RankRow[]} cities
 * @property {RankRow[]} devices
 * @property {RankRow[]} channels
 */

const INSIGHTS_REFRESH_MS = 60 * 60 * 1000;

// שיתוף בוואטסאפ מגיע כ-l.whatsapp.com / com.whatsapp / wa.me — GA משייך
// אותו ל-Organic Social/Referral ולכן הוא לא נראה בנפרד בלי הטיפול הזה.
const WHATSAPP_SOURCE = /whatsapp|wa\.me/i;
const WHATSAPP_CHANNEL = 'WhatsApp';

/** @returns {Promise<{data: YearlyInsights, updatedAt: number}|null>} */
export async function getYearlyInsights() {
	const cached = /** @type {{data:YearlyInsights,updatedAt:number}|undefined} */ (
		await getConfigValue('visitors_insights').catch(() => undefined)
	);
	if (cached?.data && Date.now() - cached.updatedAt < INSIGHTS_REFRESH_MS) return cached;

	const data = await fetchInsightsFromGA();
	if (data) {
		const value = { data, updatedAt: Date.now() };
		await setConfigValue('visitors_insights', value);
		return value;
	}
	return cached?.data ? cached : null;
}

/** @returns {Promise<YearlyInsights|null>} */
async function fetchInsightsFromGA() {
	/**
	 * @param {string|string[]} dimension
	 * @param {string} metric
	 * @param {number} limit
	 * @param {any} [extraFilter]
	 */
	const mkRequest = (dimension, metric, limit, extraFilter) => {
		const host = hostFilter();
		const expressions = [...(host ? [host] : []), ...(extraFilter ? [extraFilter] : [])];
		return {
			dateRanges: [{ startDate: '365daysAgo', endDate: 'today' }],
			dimensions: (Array.isArray(dimension) ? dimension : [dimension]).map((name) => ({ name })),
			metrics: [{ name: metric }],
			orderBys: [{ metric: { metricName: metric }, desc: true }],
			limit: String(limit),
			...(expressions.length === 1
				? { dimensionFilter: expressions[0] }
				: expressions.length > 1
					? { dimensionFilter: { andGroup: { expressions } } }
					: {})
		};
	};

	const j = await gaFetch('batchRunReports', {
		requests: [
			// צפיות בדפי עסק — limit גבוה, הסינון לפי documentId נעשה בדף
			mkRequest('pagePath', 'screenPageViews', 100, {
				filter: {
					fieldName: 'pagePath',
					stringFilter: { matchType: 'BEGINS_WITH', value: '/business/' }
				}
			}),
			mkRequest('city', 'activeUsers', 15),
			mkRequest('deviceCategory', 'activeUsers', 10),
			// ערוץ + מקור מדויק, כדי לשלוף מתוכם את שיתופי הוואטסאפ
			mkRequest(['sessionDefaultChannelGroup', 'sessionSource'], 'sessions', 200)
		]
	});
	if (!j) return null;

	/** @param {number} i @returns {RankRow[]} */
	const toRows = (i) =>
		(j.reports?.[i]?.rows ?? [])
			.map((/** @type {any} */ r) => ({
				key: r.dimensionValues?.[0]?.value ?? '',
				count: Number(r.metricValues?.[0]?.value) || 0
			}))
			.filter((/** @type {RankRow} */ r) => r.key && r.count > 0);

	// מקור וואטסאפ מקבל ערוץ משלו ומנוכה מהערוץ המקורי — בלי ספירה כפולה
	/** @type {Map<string, number>} */
	const byChannel = new Map();
	for (const r of j.reports?.[3]?.rows ?? []) {
		const channel = r.dimensionValues?.[0]?.value ?? '';
		const source = r.dimensionValues?.[1]?.value ?? '';
		const count = Number(r.metricValues?.[0]?.value) || 0;
		if (!channel || count <= 0) continue;
		const key = WHATSAPP_SOURCE.test(source) ? WHATSAPP_CHANNEL : channel;
		byChannel.set(key, (byChannel.get(key) ?? 0) + count);
	}
	const channels = [...byChannel]
		.map(([key, count]) => ({ key, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, 10);

	return {
		businessPages: toRows(0),
		cities: toRows(1),
		devices: toRows(2),
		channels
	};
}
