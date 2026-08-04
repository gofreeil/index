import { getBusinessesTotal } from '$lib/server/pendingCounts.js';
import { refreshVisitorStatsIfStale } from '$lib/server/visitorStats.js';

/**
 * מעטפת מסכי הניהול. ההרשאה עצמה נאכפת בכל מסך בנפרד (כדי לשמור על מסך
 * "אין הרשאה" של /admin), וכאן רק נטענים הנתונים המשותפים לסרגל הניווט.
 *
 * כאן גם המקום היחיד שבו מרעננים את מונה הצפיות מ-Google Analytics —
 * רק בכניסת אדמין, ורק אם עברו 15 דקות מהרענון האחרון. כך אף גולש רגיל
 * לא יוצר קריאה ל-GA. לא חוסם ולא מפיל אם GA לא מוגדר.
 * @type {import('./$types').LayoutServerLoad}
 */
export async function load({ parent }) {
	const { isAdmin } = await parent();
	if (!isAdmin) return { businessesTotal: 0 };

	const [businessesTotal] = await Promise.all([
		getBusinessesTotal(),
		refreshVisitorStatsIfStale().catch(() => {})
	]);
	return { businessesTotal };
}
