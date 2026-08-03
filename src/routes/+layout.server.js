import { listApproved, computeSchedule } from '$lib/server/adsStore.js';

// חושף את המשתמש המחובר (מ-hooks) לכל הדפים; הלקוח מאכלס ממנו את authUser.
// בנוסף — הפרסומות המאושרות (submitted-ads מבילדר הפרסומות המקומי
// /advertise/builder, ומהאתרים האחרים שחולקים את האוסף) לסרגל הצד.
export async function load({ locals }) {
	const ads = await listApproved();
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
	return { user: locals.user, approvedAds };
}
