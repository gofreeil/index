// ============================================================
// pendingCounts.js — מקור-אמת יחיד ל"כמה פריטים ממתינים לטיפול"
//
// אותו מספר מוצג בשלושה מקומות, ולכן הוא מחושב פעם אחת:
//   • הבועה האדומה על האווטאר בהאדר (בכל דף)
//   • הבועה על תמונת הפרופיל ועל אריחי הפאנל באזור האישי
//   • התגיות בסרגל הניווט של /admin
//
// ההתראה נגזרת מהמצב עצמו (רשומות pending) ולא נשמרת כ"נקראה" — לכן היא
// מופיעה אצל כל האדמינים ונעלמת מעצמה ברגע שמישהו אישר או דחה.
//
// עומס: ארבע ספירות זולות (pageSize=1, קריאת meta בלבד) עם מטמון של דקה
// בזיכרון. גולש שאינו אדמין לא מגיע לכאן בכלל.
// ============================================================

import {
	countPendingBusinesses,
	countPendingReviews,
	countOpenReports,
	countAllBusinesses
} from './strapi.js';
import { countPending as countPendingAds } from './adsStore.js';

const TTL_MS = 60_000;

/**
 * @typedef {Object} PendingCounts
 * @property {number} businesses עסקים חדשים שממתינים לאישור
 * @property {number} reviews    ביקורות שממתינות לאישור
 * @property {number} reports    דיווחים פתוחים
 * @property {number} ads        פרסומות שממתינות לאישור
 * @property {number} total      סך הכל — המספר שבבועה
 */

/** @type {{ at: number, data: PendingCounts } | null} */
let cache = null;

const EMPTY = { businesses: 0, reviews: 0, reports: 0, ads: 0, total: 0 };

/** מאפס את המטמון — נקרא אחרי פעולת מודרציה כדי שהבועה תתעדכן מיד. */
export function invalidatePendingCounts() {
	cache = null;
}

/**
 * הפריטים שממתינים לטיפול אדמין. כל ספירה נכשלת בנפרד (0) ולא מפילה את השאר.
 * @returns {Promise<PendingCounts>}
 */
export async function getPendingCounts() {
	if (cache && Date.now() - cache.at < TTL_MS) return cache.data;

	const [businesses, reviews, reports, ads] = await Promise.all([
		countPendingBusinesses().catch(() => 0),
		countPendingReviews().catch(() => 0),
		countOpenReports().catch(() => 0),
		countPendingAds().catch(() => 0)
	]);

	const data = {
		businesses,
		reviews,
		reports,
		ads,
		total: businesses + reviews + reports + ads
	};
	cache = { at: Date.now(), data };
	return data;
}

/** ערכי אפס — לגולש שאינו אדמין, בלי אף קריאת רשת. @returns {PendingCounts} */
export function noPendingCounts() {
	return { ...EMPTY };
}

// ── מונה הכרטיסיות במאגר ──
// אינו התראה אלא "כמה נתונים יש" — מוצג על אריח הכרטיסיות ובסרגל הניווט,
// ולכן נשלף רק ממסכי הניהול ועם מטמון ארוך יותר.
/** @type {{ at: number, n: number } | null} */
let totalCache = null;
const TOTAL_TTL_MS = 5 * 60 * 1000;

/** @returns {Promise<number>} */
export async function getBusinessesTotal() {
	if (totalCache && Date.now() - totalCache.at < TOTAL_TTL_MS) return totalCache.n;
	const n = await countAllBusinesses().catch(() => 0);
	totalCache = { at: Date.now(), n };
	return n;
}
