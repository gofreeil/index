import { env } from '$env/dynamic/private';
import { listApprovedLive, computeAdSlots, adImageUrl } from '$lib/server/adsStore.js';
import { isPrivileged, isSuperAdmin } from '$lib/server/strapi.js';
import { getPendingCounts, noPendingCounts } from '$lib/server/pendingCounts.js';
import { countMatchesForUser } from '$lib/server/ownerMatch.js';

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

	const [ads, pending, myMatches] = await Promise.all([
		// פרסומת שפג תוקפה או שהושהתה יורדת מהאתר מעצמה (הרשומה נשארת לפאנל הניהול)
		listApprovedLive(),
		isAdmin
			? getPendingCounts().catch(() => noPendingCounts())
			: Promise.resolve(noPendingCounts()),
		// כרטיסיות שהמערכת זיהתה כשייכות למשתמש והוא עוד לא דרש אותן —
		// אותה בועה אדומה, מהצד של בעל העסק. ממוטמן לעשר דקות לכל משתמש.
		user ? countMatchesForUser(user).catch(() => 0) : Promise.resolve(0)
	]);

	// מספר המקום (1..12) קובע גם את סדר הפרסומות וגם אילו משבצות פנויות
	// מוצגות סביבן — נקבע במסך הניהול ומחושב כאן פעם אחת לכל הרשימה.
	//
	// התמונות עוברות ככתובת ולא כ-base64: ה-load הזה רץ בכל ניווט בכל עמוד,
	// ולכן הטבעת התמונות כאן שלחה אותן מחדש בכל צפייה (3,074KB מתוך 3,574KB
	// של הדף, כל אחת פעמיים — ב-HTML ובנתוני ההידרציה). ראו adImageUrl.
	const liveSlots = computeAdSlots(ads);
	const approvedAds = ads.map((a) => ({
		id: a.id,
		title: a.title,
		subtitle: a.subtitle,
		cta: a.cta,
		hover: a.hoverText,
		gradient: a.gradient,
		// הלוגו והעיצוב שהמפרסם קבע — בלעדיהם הכרטיס נבנה מברירות המחדל
		// של האתר והמודעה מתפרסמת בלי הלוגו שהועלה
		logo: adImageUrl(a, 'logo'),
		mainImage: adImageUrl(a, 'main'),
		// מיקום+זום שנבחרו בבילדר — מוחלים בתצוגת הסרגל (adImgFit)
		mainImageFit: a.mainImageFit,
		adStyle: a.adStyle,
		// מספר המקום בטור (1..12) — נקבע במסך הניהול
		slot: liveSlots.get(a.id)
	}));

	return {
		user,
		approvedAds,
		isAdmin,
		superAdmin: isSuperAdmin(user),
		pending,
		myMatches,
		// מזהה המדידה של Google Analytics (G-XXXX). ריק = אין GA, ואז ה-gtag
		// לא נטען בכלל.
		gaId: (env.GA_MEASUREMENT_ID ?? '').trim()
	};
}
