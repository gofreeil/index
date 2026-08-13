import { json } from '@sveltejs/kit';
import { revealPhone, trackView } from '$lib/server/strapi.js';
import { flushIfDue, recordPhoneClick } from '$lib/server/searchStats.js';

// מוני מעורבות אמיתיים על העסק ב-Strapi (increment אטומי), במקום כתיבה לגיליון
// write-only שאיש לא קרא. action: 'reveal_phone' | 'phone_click' | 'view'.
//
// שתי מדרגות טלפון, ולא אחת: reveal_phone הוא "הצג מספר" — הרגע שבו הגולש
// ביקש את המספר, והוא זה שנספר על הכרטיסייה עצמה; phone_click הוא לחיצה על
// המספר החשוף, כלומר חיוג בפועל. ההפרש ביניהן הוא כמה מהמציצים באמת התקשרו,
// ושתיהן נצברות גם לפי יום ב-searchStats כדי שיהיה קו לאורך זמן.
export async function POST({ request }) {
	try {
		const { documentId, action } = await request.json();
		if (!documentId) return json({ success: false }, { status: 400 });

		if (action === 'reveal_phone') {
			const res = await revealPhone(documentId);
			recordPhoneClick('reveal');
			await flushIfDue();
			return json({ success: true, phone: res?.phone ?? '' });
		}
		if (action === 'phone_click') {
			recordPhoneClick('call');
			await flushIfDue();
			return json({ success: true });
		}
		await trackView(documentId);
		return json({ success: true });
	} catch (e) {
		console.error('stats error:', e);
		return json({ success: false }, { status: 502 });
	}
}
