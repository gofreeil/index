import { listApproved, computeSchedule } from '$lib/server/adsStore.js';

// חושף את המשתמש המחובר (מ-hooks) לכל הדפים; הלקוח מאכלס ממנו את authUser.
// בנוסף — הפרסומות המאושרות (submitted-ads מהבילדר של הקהילה) לסרגל הצד.
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
			mainImage: a.mainImage
		}));
	return { user: locals.user, approvedAds };
}
