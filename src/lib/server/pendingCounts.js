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
import { countPendingClaims } from './claimsStore.js';
import { countOpenMatches } from './ownerMatch.js';

const TTL_MS = 60_000;

/**
 * @typedef {Object} PendingCounts
 * @property {number} businesses עסקים חדשים שממתינים לאישור
 * @property {number} reviews    ביקורות שממתינות לאישור
 * @property {number} reports    דיווחים פתוחים
 * @property {number} ads        פרסומות שממתינות לאישור
 * @property {number} claims     בקשות בעלות + התאמות שהמערכת מצאה
 * @property {number} total      סך הכל — המספר שבבועה
 */

/** @type {{ at: number, data: PendingCounts } | null} */
let cache = null;

const EMPTY = { businesses: 0, reviews: 0, reports: 0, ads: 0, claims: 0, total: 0 };

/** מאפס את המטמון — נקרא אחרי פעולת מודרציה כדי שהבועה תתעדכן מיד. */
export function invalidatePendingCounts() {
	cache = null;
}

/**
 * הפריטים שממתינים לטיפול אדמין. כל ספירה נכשלת בנפרד (0) ולא מפילה את השאר.
 * @param {{ maxAgeMs?: number }} [opts] גיל מרבי של המטמון; ברירת המחדל TTL_MS
 * @returns {Promise<PendingCounts>}
 */
export async function getPendingCounts({ maxAgeMs = TTL_MS } = {}) {
	if (cache && Date.now() - cache.at < maxAgeMs) return cache.data;

	// בעלות: גם בקשות שמשתמשים שלחו, וגם התאמות שהמערכת מצאה ואיש עוד לא
	// דרש — שתיהן פריטים שמחכים להכרעת אדמין באותו מסך (/admin/claims).
	const [businesses, reviews, reports, ads, claimRequests, openMatches] = await Promise.all([
		countPendingBusinesses().catch(() => 0),
		countPendingReviews().catch(() => 0),
		countOpenReports().catch(() => 0),
		countPendingAds().catch(() => 0),
		countPendingClaims().catch(() => 0),
		countOpenMatches().catch(() => 0)
	]);

	const claims = claimRequests + openMatches;
	const data = {
		businesses,
		reviews,
		reports,
		ads,
		claims,
		total: businesses + reviews + reports + ads + claims
	};
	cache = { at: Date.now(), data };
	return data;
}

// בתוך פאנל הניהול המספר חייב להיות אמיתי: מטמון של דקה אינו משותף בין
// מופעי השרת, ולכן אישור של אדמין אחד השאיר בועה דולקת אצל השני מעל רשימה
// ריקה. חלון של חמש שניות מספיק כדי לא לשלוף פעמיים באותה בקשה (ה-layout
// הראשי כבר שלף), ובפועל הוא תמיד טרי.
const FRESH_MS = 5_000;

/** ספירה טרייה — למסכים שמציגים גם את הרשימה עצמה. @returns {Promise<PendingCounts>} */
export const getFreshPendingCounts = () => getPendingCounts({ maxAgeMs: FRESH_MS });

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
