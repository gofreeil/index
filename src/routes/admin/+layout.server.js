import {
	getBusinessesTotal,
	getFreshPendingCounts,
	noPendingCounts
} from '$lib/server/pendingCounts.js';
import { refreshVisitorStatsIfStale } from '$lib/server/visitorStats.js';
import { getUserProfile } from '$lib/server/strapi.js';
import { toMobileE164 } from '$lib/server/sms.js';

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
 *
 * smsReady: התראות הניהול יוצאות לנייד מהשרת המשותף (community-backend,
 * utils/adminSms.ts) — רק לנייד שברשומה המשותפת. אדמין בלי נייד שם לא מקבל
 * כלום ולא יודע למה, ולכן הפאנל מציג לו פס קצר עם קישור להוספה.
 * @type {import('./$types').LayoutServerLoad}
 */
export async function load({ parent, depends, locals }) {
	depends('app:pending');
	const { isAdmin } = await parent();
	if (!isAdmin) return { businessesTotal: 0, pending: noPendingCounts(), smsReady: true };

	const [businessesTotal, pending, sharedProfile] = await Promise.all([
		getBusinessesTotal(),
		getFreshPendingCounts().catch(() => noPendingCounts()),
		locals.user?.id ? getUserProfile(locals.user.id) : Promise.resolve(null),
		refreshVisitorStatsIfStale().catch(() => {})
	]);
	// getUserProfile מחזיר שם ריק רק כשהשליפה נכשלה (לרשומה אמיתית תמיד יש שם
	// תצוגה) — ואז לא מציגים פס: עדיף לפספס תזכורת מאשר להציק בטעות
	const smsReady =
		!sharedProfile?.name || Boolean(toMobileE164(sharedProfile.phone));
	return { businessesTotal, pending, smsReady };
}
