// ============================================================
// siteStats.js — סטטיסטיקה פנימית, מהנתונים שכבר יש לנו ב-Strapi
//
// להבדיל מ-visitorStats.js (שנשען על Google Analytics וצריך הגדרה),
// כאן הכול נגזר מהמאגר עצמו ולכן עובד מהרגע הראשון:
//   • גידול המאגר לפי חודשים
//   • הכרטיסיות הנצפות ביותר וחשיפות הטלפון בהן
//   • התפלגות לפי קטגוריה ולפי עיר
//   • ביקורות ודירוג ממוצע
//
// מטמון של 5 דקות בזיכרון — המסך נצפה רק ע"י אדמינים, ואין טעם לשלוף
// את כל המאגר בכל רענון.
// ============================================================

import { listBusinessesForStats, listReviewsForStats } from './strapi.js';

const TTL_MS = 5 * 60 * 1000;

// חודש בפורמט YYYYMM לפי שעון ישראל — כדי שכרטיסייה שנוצרה בליל ראשון-לחודש
// לא תיספר בחודש הקודם (createdAt נשמר ב-UTC).
const YM_FMT = new Intl.DateTimeFormat('en-CA', {
	timeZone: 'Asia/Jerusalem',
	year: 'numeric',
	month: '2-digit'
});
/** @param {Date} date */
const toYm = (date) => YM_FMT.format(date).replace('-', '');

/**
 * 12 החודשים האחרונים (ישן→חדש) עם כמה כרטיסיות נוספו בכל אחד.
 * @param {any[]} all
 * @returns {{yearMonth: string, added: number}[]}
 */
function growth(all) {
	const nowYm = toYm(new Date());
	const y = Number(nowYm.slice(0, 4));
	const m = Number(nowYm.slice(4, 6));
	const rows = Array.from({ length: 12 }, (_, i) => {
		const d = new Date(y, m - 12 + i, 1);
		return {
			yearMonth: `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`,
			added: 0
		};
	});
	const byYm = new Map(rows.map((r) => [r.yearMonth, r]));
	for (const b of all) {
		if (!b.createdAt) continue;
		const row = byYm.get(toYm(new Date(b.createdAt)));
		if (row) row.added++;
	}
	return rows;
}

/**
 * דירוג ערכים לפי שכיחות (קטגוריה / עיר), מהגבוה לנמוך.
 * @param {any[]} all @param {string} field @param {number} limit
 * @returns {{key: string, count: number}[]}
 */
function rank(all, field, limit) {
	/** @type {Map<string, number>} */
	const counts = new Map();
	for (const b of all) {
		const key = String(b[field] ?? '').trim();
		if (!key) continue;
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return [...counts]
		.map(([key, count]) => ({ key, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, limit);
}

/** @param {any} b */
const slim = (b) => ({
	documentId: b.documentId,
	name: b.name || '',
	category: b.category || '',
	city: b.city || '',
	views: Number(b.view_count) || 0,
	reveals: Number(b.phone_reveal_count) || 0,
	rating: Number(b.rating_avg) || 0,
	ratingCount: Number(b.rating_count) || 0
});

/**
 * @typedef {Object} DirectoryStats
 * @property {{all:number,approved:number,pending:number,rejected:number,frozen:number,withDiscount:number}} totals
 * @property {{views:number,reveals:number,rated:number,avgRating:number}} engagement
 * @property {{yearMonth:string,added:number}[]} growth
 * @property {ReturnType<typeof slim>[]} topViewed
 * @property {ReturnType<typeof slim>[]} topReveals
 * @property {ReturnType<typeof slim>[]} topRated
 * @property {{key:string,count:number}[]} categories
 * @property {{key:string,count:number}[]} cities
 * @property {{total:number,pending:number,approved:number,avgRating:number}} reviews
 * @property {number} updatedAt
 */

/** @type {{ at: number, data: DirectoryStats } | null} */
let cache = null;

// רשימת הכרטיסיות הגולמית — משותפת לסטטיסטיקה ולפענוח נתיבי ה-GA,
// כדי ששני אלה לא ישלפו את המאגר פעמיים באותה טעינת עמוד.
/** @type {{ at: number, rows: any[] } | null} */
let listCache = null;

/** @returns {Promise<any[]>} */
async function allBusinesses() {
	if (listCache && Date.now() - listCache.at < TTL_MS) return listCache.rows;
	const rows = await listBusinessesForStats();
	listCache = { at: Date.now(), rows };
	return rows;
}

/**
 * ממיר נתיבי /business/{documentId} שהגיעו מ-GA לרשימת כרטיסיות עם שם.
 * מאחד כפילויות (עם/בלי לוכסן סופי) ומסנן נתיבים שאינם דף כרטיסייה או
 * כרטיסיות שכבר נמחקו.
 * @param {{key: string, count: number}[]} rows
 * @param {number} [limit]
 * @returns {Promise<{documentId: string, name: string, city: string, count: number}[]>}
 */
export async function resolveBusinessPages(rows, limit = 10) {
	if (!rows?.length) return [];
	const all = await allBusinesses().catch(() => []);
	const byId = new Map(all.map((b) => [String(b.documentId), b]));
	/** @type {Map<string, number>} */
	const views = new Map();
	for (const r of rows) {
		const m = r.key.match(/^\/business\/([^/?#]+)\/?$/);
		if (!m) continue;
		const id = decodeURIComponent(m[1]);
		if (!byId.has(id)) continue;
		views.set(id, (views.get(id) ?? 0) + r.count);
	}
	return [...views.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([id, count]) => {
			const b = byId.get(id);
			return { documentId: id, name: b?.name ?? '', city: b?.city ?? '', count };
		});
}

/**
 * כל הסטטיסטיקה הפנימית. זורק רק אם Strapi לא זמין בכלל — הקורא עוטף ב-catch.
 * @returns {Promise<DirectoryStats>}
 */
export async function getDirectoryStats() {
	if (cache && Date.now() - cache.at < TTL_MS) return cache.data;

	const [all, reviews] = await Promise.all([
		allBusinesses(),
		listReviewsForStats().catch(() => [])
	]);

	/** @param {string} st */
	const byStatus = (st) => all.filter((b) => (b.status || 'pending') === st).length;

	const views = all.reduce((sum, b) => sum + (Number(b.view_count) || 0), 0);
	const reveals = all.reduce((sum, b) => sum + (Number(b.phone_reveal_count) || 0), 0);
	const rated = all.filter((b) => Number(b.rating_count) > 0);
	const avgRating = rated.length
		? rated.reduce((sum, b) => sum + Number(b.rating_avg || 0), 0) / rated.length
		: 0;

	const approvedReviews = reviews.filter((r) => r.status === 'approved');
	const reviewsAvg = approvedReviews.length
		? approvedReviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / approvedReviews.length
		: 0;

	const data = {
		totals: {
			all: all.length,
			approved: byStatus('approved'),
			pending: byStatus('pending'),
			rejected: byStatus('rejected'),
			frozen: byStatus('frozen'),
			withDiscount: all.filter((b) => String(b.discount ?? '').trim()).length
		},
		engagement: { views, reveals, rated: rated.length, avgRating },
		growth: growth(all),
		topViewed: [...all]
			.sort((a, b) => (Number(b.view_count) || 0) - (Number(a.view_count) || 0))
			.slice(0, 10)
			.map(slim)
			.filter((b) => b.views > 0),
		topReveals: [...all]
			.sort((a, b) => (Number(b.phone_reveal_count) || 0) - (Number(a.phone_reveal_count) || 0))
			.slice(0, 10)
			.map(slim)
			.filter((b) => b.reveals > 0),
		topRated: [...all]
			.filter((b) => Number(b.rating_count) > 0)
			.sort(
				(a, b) =>
					Number(b.rating_avg) - Number(a.rating_avg) ||
					Number(b.rating_count) - Number(a.rating_count)
			)
			.slice(0, 10)
			.map(slim),
		categories: rank(all, 'category', 12),
		cities: rank(all, 'city', 12),
		reviews: {
			total: reviews.length,
			pending: reviews.filter((r) => r.status === 'pending').length,
			approved: approvedReviews.length,
			avgRating: reviewsAvg
		},
		updatedAt: Date.now()
	};

	cache = { at: Date.now(), data };
	return data;
}
