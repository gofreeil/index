import {
	getBusinessesTotal,
	getFreshPendingCounts,
	noPendingCounts
} from '$lib/server/pendingCounts.js';
import { refreshVisitorStatsIfStale } from '$lib/server/visitorStats.js';

/**
 * מעטפת מסכי הניהול. ההרשאה עצמה נאכפת בכל מסך בנפרד (כדי לשמור על מסך
 * "אין הרשאה" של /admin), וכאן רק נטענים הנתונים המשותפים לסרגל הניווט.
 *
 * pending נשלף כאן שוב, טרי, ודורס את זה שב-layout הראשי: שם הוא נטען פעם
 * אחת בטעינת הדף ואינו רץ מחדש בניווט צד-לקוח, ולכן הבועה נשארה תקועה על
 * המספר שהיה כשנפתחה הלשונית — גם אחרי שאדמין אחר טיפל. depends + invalidate
 * (ב-+layout.svelte) מריצים את ה-load הזה בכל מעבר בתוך הפאנל.
 *
 * כאן גם המקום היחיד שבו מרעננים את מונה הצפיות מ-Google Analytics —
 * רק בכניסת אדמין, ורק אם עברו 15 דקות מהרענון האחרון. כך אף גולש רגיל
 * לא יוצר קריאה ל-GA. לא חוסם ולא מפיל אם GA לא מוגדר.
 * @type {import('./$types').LayoutServerLoad}
 */
export async function load({ parent, depends }) {
	depends('app:pending');
	const { isAdmin } = await parent();
	if (!isAdmin) return { businessesTotal: 0, pending: noPendingCounts() };

	const [businessesTotal, pending] = await Promise.all([
		getBusinessesTotal(),
		getFreshPendingCounts().catch(() => noPendingCounts()),
		refreshVisitorStatsIfStale().catch(() => {})
	]);
	return { businessesTotal, pending };
}
