import { json } from '@sveltejs/kit';
import { flushIfDue, recordSearches } from '$lib/server/searchStats.js';

// נקודת המדידה של החיפושים (ראו $lib/searchTrack.js). מקבלת מקבץ אירועים,
// רושמת אותם בזיכרון ומחזירה מיד — הכתיבה ל-Strapi נדחית לשטיפה מרוכזת.
// תמיד 204: כשל מדידה לא צריך להרעיש בקונסולה של הגולש.

const MAX_EVENTS = 20;

export async function POST({ request }) {
	try {
		const body = await request.json();
		const raw = Array.isArray(body?.events) ? body.events.slice(0, MAX_EVENTS) : [];
		const events = raw
			.map((/** @type {any} */ e) => ({
				q: String(e?.q ?? ''),
				zero: e?.zero === true,
				replaces: e?.replaces?.q
					? { q: String(e.replaces.q), zero: e.replaces.zero === true }
					: undefined
			}))
			.filter((/** @type {any} */ e) => e.q.trim().length >= 2);
		if (events.length) {
			recordSearches(events);
			// המתנה לשטיפה כשהגיע זמנה: על Vercel הלמבדה עלולה להיסגר ברגע
			// שהתשובה יצאה, ושטיפה שלא הומתן לה הייתה מאבדת את הצבירה.
			await flushIfDue();
		}
	} catch {
		/* גוף לא תקין — מתעלמים */
	}
	return new Response(null, { status: 204 });
}

// בקשת GET ידנית מחזירה סטטוס — נוח לבדוק שהנתיב חי אחרי פריסה
export function GET() {
	return json({ ok: true });
}
