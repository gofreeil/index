import { json } from '@sveltejs/kit';
import { revealPhone, trackView } from '$lib/server/strapi.js';

// מוני מעורבות אמיתיים על העסק ב-Strapi (increment אטומי), במקום כתיבה לגיליון
// write-only שאיש לא קרא. action: 'reveal_phone' | 'view'.
export async function POST({ request }) {
	try {
		const { documentId, action } = await request.json();
		if (!documentId) return json({ success: false }, { status: 400 });

		if (action === 'reveal_phone' || action === 'phone_click') {
			const res = await revealPhone(documentId);
			return json({ success: true, phone: res?.phone ?? '' });
		}
		await trackView(documentId);
		return json({ success: true });
	} catch (e) {
		console.error('stats error:', e);
		return json({ success: false }, { status: 502 });
	}
}
