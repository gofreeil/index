import { env } from '$env/dynamic/private';
import { listApproved, computeSchedule } from '$lib/server/adsStore.js';
import { isPrivileged, isSuperAdmin } from '$lib/server/strapi.js';
import { getPendingCounts, noPendingCounts } from '$lib/server/pendingCounts.js';

// חושף את המשתמש המחובר (מ-hooks) לכל הדפים; הלקוח מאכלס ממנו את authUser.
// בנוסף — הפרסומות המאושרות (submitted-ads מבילדר הפרסומות המקומי
// /advertise/builder, ומהאתרים האחרים שחולקים את האוסף) לסרגל הצד.
//
// pending — הפריטים שממתינים לטיפול אדמין (עסקים, ביקורות, דיווחים,
// פרסומות). זה המספר שבבועה האדומה על האווטאר בהאדר, ואותו מספר בדיוק
// מוצג על תמונת הפרופיל ועל אריחי הפאנל באזור האישי. נשלף רק לאדמין,
// עם מטמון של דקה (ראו pendingCounts.js) — לגולש רגיל אין כאן שום עלות.
export async function load({ locals }) {
	const user = locals.user;
	const isAdmin = isPrivileged(user);

	const [ads, pending] = await Promise.all([
		listApproved(),
		isAdmin ? getPendingCounts().catch(() => noPendingCounts()) : Promise.resolve(noPendingCounts())
	]);

	const approvedAds = ads
		// פרסומת שפג תוקפה יורדת מהאתר מעצמה (הרשומה נשארת לפאנל הניהול)
		.filter((a) => computeSchedule(a)?.state !== 'expired')
		.map((a) => ({
			id: a.id,
			title: a.title,
			subtitle: a.subtitle,
			cta: a.cta,
			hover: a.hoverText,
			gradient: a.gradient,
			mainImage: a.mainImage,
			// מיקום+זום שנבחרו בבילדר — מוחלים בתצוגת הסרגל (adImgFit)
			mainImageFit: a.mainImageFit
		}));

	return {
		user,
		approvedAds,
		isAdmin,
		superAdmin: isSuperAdmin(user),
		pending,
		// מזהה המדידה של Google Analytics (G-XXXX). ריק = אין GA, ואז ה-gtag
		// לא נטען בכלל.
		gaId: (env.GA_MEASUREMENT_ID ?? '').trim()
	};
}
