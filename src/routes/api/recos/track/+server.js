import { json } from '@sveltejs/kit';
import { flushIfDue, recordCategoryClicks } from '$lib/server/categoryClicks.js';

// נקודת המדידה של המנוע החכם (ראו $lib/recoTrack.js): לחיצה על כרטיסייה
// בזמן שתחום מסונן נרשמת כצמד (תחום, עסק). אותו דפוס של מדידת החיפושים —
// רישום בזיכרון, תשובה מיידית, והכתיבה ל-Strapi נדחית לשטיפה מרוכזת.
// תמיד 204: כשל מדידה לא צריך להרעיש בקונסולה של הגולש.

const MAX_EVENTS = 10;

export async function POST({ request }) {
	try {
		const body = await request.json();
		const raw = Array.isArray(body?.events) ? body.events.slice(0, MAX_EVENTS) : [];
		const events = raw
			.map((/** @type {any} */ e) => ({ c: String(e?.c ?? ''), id: String(e?.id ?? '') }))
			.filter((/** @type {any} */ e) => e.c.trim().length >= 2 && e.id.trim());
		if (events.length) {
			recordCategoryClicks(events);
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
