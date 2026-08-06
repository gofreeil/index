import { json, error } from '@sveltejs/kit';
import { submitAd } from '$lib/server/adsStore.js';
import { isOwnerCode, notifyOwnerCodeUse, notifyAdminsNewAd } from '$lib/server/adsCode.js';

// קליטת פרסומת חדשה מהבילדר המקומי (/advertise/builder) — נשמרת באוסף
// submitted-ads המשותף במצב "ממתינה לאישור". האישור עצמו ידני ב-/admin/ads.
// חובה להיות מחובר: מודעה בלי submitted_by היא מודעה בלי בעלים — המפרסם
// לא יוכל לעולם לראות את הביצועים שלה, לערוך אותה או לחדש.
/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	const user = locals.user;
	if (!user) {
		throw error(
			401,
			'צריך להתחבר לפני השליחה — כך הפרסומת נשמרת על החשבון שלכם ותוכלו לעקוב אחריה ולערוך אותה'
		);
	}

	/** @type {any} */
	let payload;
	try {
		payload = await request.json();
	} catch {
		throw error(400, 'גוף הבקשה חייב להיות JSON תקין');
	}

	for (const k of ['title', 'subtitle', 'mainImage', 'gradient']) {
		if (!payload?.[k] || typeof payload[k] !== 'string') {
			throw error(400, `חסר שדה: ${k}`);
		}
	}
	if (!payload.landing || typeof payload.landing !== 'object') {
		throw error(400, 'חסר אובייקט landing');
	}

	// הקוד מאומת כאן, בשרת — לא סומכים על דגל payment מהדפדפן
	const usedOwnerCode = isOwnerCode(payload.ownerCode);
	const requestedDurationDays = Number(payload.requestedDurationDays) === 180 ? 180 : 30;
	try {
		const ad = await submitAd({
			submittedBy: {
				id: String(user.id ?? ''),
				email: user.email ?? '',
				name: user.name ?? ''
			},
			title: payload.title,
			subtitle: payload.subtitle,
			payment: usedOwnerCode ? 'code' : 'pending',
			requestedDurationDays,
			hoverText: payload.hoverText ?? '',
			cta: payload.cta ?? '',
			gradient: payload.gradient,
			logo: payload.logo ?? '',
			mainImage: payload.mainImage,
			mainImageFit: payload.mainImageFit,
			// העיצוב מהבילדר (לוגו, רצועה, כותרת) — בלעדיו הפרסומת מתפרסמת
			// עם ברירות המחדל של האתר ולא עם מה שהמפרסם ראה על המסך
			adStyle: payload.adStyle,
			landing: {
				headline: payload.landing.headline ?? '',
				pitch: payload.landing.pitch ?? '',
				extended: payload.landing.extended ?? '',
				image: payload.landing.image ?? '',
				advantages: [
					payload.landing.advantages?.[0] ?? '',
					payload.landing.advantages?.[1] ?? '',
					payload.landing.advantages?.[2] ?? ''
				],
				uniqueness: payload.landing.uniqueness ?? '',
				phone: payload.landing.phone ?? '',
				whatsapp: payload.landing.whatsapp ?? '',
				website: payload.landing.website ?? '',
				email: payload.landing.email ?? '',
				address: payload.landing.address ?? '',
				hours: payload.landing.hours ?? '',
				products: Array.isArray(payload.landing.products) ? payload.landing.products : []
			}
		});
		// התראה על *כל* בקשת פרסום — קודם היא נשלחה רק על שימוש בקוד בעלים,
		// כך שמפרסם רגיל הגיש פרסומת ואיש לא ידע עליה. לא חוסמת ולא מפילה.
		// מפרסם ששב לשפר פרסומת קיימת מקבל ניסוח "עדכון" ולא "בקשה חדשה"
		await notifyAdminsNewAd({
			adTitle: payload.title,
			durationDays: requestedDurationDays,
			usedOwnerCode,
			submitter: { name: user.name ?? '', email: user.email ?? '' },
			replacesTitle: ad.replacesTitle,
			replacesLive: ad.replacesStatus === 'approved'
		});
		// התראה נפרדת על שימוש בקוד — נשמרת כדי לא לאבד את ההתראה הייעודית
		if (usedOwnerCode) {
			await notifyOwnerCodeUse({
				adTitle: payload.title,
				durationDays: requestedDurationDays,
				submitter: { name: user.name ?? '', email: user.email ?? '' }
			});
		}
		return json({ ok: true, id: ad.id, status: ad.status });
	} catch (err) {
		console.error('ads/submit failed:', err);
		// תקרת koa-body של Strapi (~1MB) — שגיאה שהמפרסם יכול לתקן בעצמו
		if (err instanceof Error && err.message.includes('→ 413')) {
			throw error(413, 'התמונות כבדות מדי — הקטינו תמונה ונסו שוב');
		}
		throw error(502, 'השליחה נכשלה — נסו שוב בעוד רגע');
	}
}
