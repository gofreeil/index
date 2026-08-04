import { json } from '@sveltejs/kit';
import { recordAdEvents, AD_METRICS } from '$lib/server/adStats.js';

// נקודת המדידה של הפרסומות (ראו $lib/adTrack.js). מקבלת מקבץ אירועים,
// רושמת אותם בזיכרון ומחזירה מיד — הכתיבה ל-Strapi נדחית לשטיפה מרוכזת.
// תמיד 204: כשל מדידה לא צריך להרעיש בקונסולה של הגולש.

const MAX_EVENTS = 50;

export async function POST({ request }) {
	try {
		const body = await request.json();
		const raw = Array.isArray(body?.events) ? body.events.slice(0, MAX_EVENTS) : [];
		const events = raw
			.map((/** @type {any} */ e) => ({ id: String(e?.id ?? '').trim(), metric: e?.metric }))
			.filter((/** @type {any} */ e) => e.id && AD_METRICS.includes(e.metric));
		if (events.length) recordAdEvents(events);
	} catch {
		/* גוף לא תקין — מתעלמים */
	}
	return new Response(null, { status: 204 });
}

// בקשת GET ידנית מחזירה סטטוס — נוח לבדוק שהנתיב חי אחרי פריסה
export function GET() {
	return json({ ok: true, metrics: AD_METRICS });
}
