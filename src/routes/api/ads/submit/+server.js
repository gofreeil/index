import { json, error } from '@sveltejs/kit';
import { submitAd } from '$lib/server/adsStore.js';
import { isOwnerCode, notifyOwnerCodeUse } from '$lib/server/adsCode.js';

// קליטת פרסומת חדשה מהבילדר המקומי (/advertise/builder) — נשמרת באוסף
// submitted-ads המשותף במצב "ממתינה לאישור". אין דרישת התחברות —
// הסינון האמיתי הוא האישור הידני ב-/admin/ads.
/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
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

	const user = locals.user;
	// הקוד מאומת כאן, בשרת — לא סומכים על דגל payment מהדפדפן
	const usedOwnerCode = isOwnerCode(payload.ownerCode);
	const requestedDurationDays = Number(payload.requestedDurationDays) === 180 ? 180 : 30;
	try {
		const ad = await submitAd({
			submittedBy: user
				? {
						id: String(user.id ?? ''),
						email: user.email ?? '',
						name: user.name ?? ''
					}
				: undefined,
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
		// התראה לבעלים על שימוש בקוד — לא חוסמת ולא מפילה את ההגשה
		if (usedOwnerCode) {
			await notifyOwnerCodeUse({
				adTitle: payload.title,
				durationDays: requestedDurationDays,
				submitter: user ? { name: user.name ?? '', email: user.email ?? '' } : null
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
