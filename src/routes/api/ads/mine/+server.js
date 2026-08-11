import { json, error } from '@sveltejs/kit';
import { getOwnAdForEdit } from '$lib/server/adsStore.js';

// GET /api/ads/mine?id=<documentId>
// התוכן המלא של פרסומת אחת של המשתמש המחובר - להזנת הבילדר בעריכה
// ממוקדת ("ערוך" על פרסומת מסוימת באזור האישי). הבעלות מאומתת בשרת
// לפי מפתחות הזהות של המפרסם; מזהה זר מחזיר 404 בלי להסגיר שהוא קיים.
/** @type {import('./$types').RequestHandler} */
export async function GET({ url, locals }) {
	const user = locals.user;
	if (!user) throw error(401, 'נדרשת התחברות');

	const id = url.searchParams.get('id')?.trim();
	if (!id) throw error(400, 'חסר מזהה פרסומת');

	const ad = await getOwnAdForEdit(id, {
		id: String(user.id ?? ''),
		email: user.email ?? ''
	}).catch(() => null);
	if (!ad) throw error(404, 'הפרסומת לא נמצאה או שאינה שייכת לחשבון הזה');

	// רק מה שהבילדר צריך כדי להמשיך לערוך - תוכן ועיצוב, בלי שדות ניהול
	// ובלי המפתחות הפנימיים (_site, _order וכו') שחיים בתוך landing.
	const L = /** @type {any} */ (ad.landing ?? {});
	return json({
		id: ad.id,
		status: ad.status,
		title: ad.title,
		subtitle: ad.subtitle,
		hoverText: ad.hoverText,
		cta: ad.cta,
		gradient: ad.gradient,
		logo: ad.logo,
		mainImage: ad.mainImage,
		mainImageFit: ad.mainImageFit,
		adStyle: ad.adStyle,
		landing: {
			headline: L?.headline ?? '',
			pitch: L?.pitch ?? '',
			extended: L?.extended ?? '',
			image: L?.image ?? '',
			advantages: [
				L?.advantages?.[0] ?? '',
				L?.advantages?.[1] ?? '',
				L?.advantages?.[2] ?? ''
			],
			uniqueness: L?.uniqueness ?? '',
			phone: L?.phone ?? '',
			whatsapp: L?.whatsapp ?? '',
			website: L?.website ?? '',
			email: L?.email ?? '',
			address: L?.address ?? '',
			hours: L?.hours ?? '',
			products: Array.isArray(L?.products) ? L.products : []
		}
	});
}
