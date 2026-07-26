import { json, error } from '@sveltejs/kit';
import { submitAd } from '$lib/server/adsStore.js';

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
			// "code" = הוזן קוד התנועה בשליחה — נשלח כמי ששולם; אחרת התשלום לתיאום
			payment: payload.payment === 'code' ? 'code' : 'pending',
			requestedDurationDays: Number(payload.requestedDurationDays) === 180 ? 180 : 30,
			hoverText: payload.hoverText ?? '',
			cta: payload.cta ?? '',
			gradient: payload.gradient,
			logo: payload.logo ?? '',
			mainImage: payload.mainImage,
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
		return json({ ok: true, id: ad.id, status: ad.status });
	} catch (err) {
		console.error('ads/submit failed:', err);
		throw error(502, 'השליחה נכשלה — נסו שוב בעוד רגע');
	}
}
