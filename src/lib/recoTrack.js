// ============================================================
// recoTrack.js — רישום "מתוך איזה תחום נפתחה הכרטיסייה", מצד הדפדפן
//
// הדלק של המנוע החכם שבתחתית תוצאות הסינון: כל לחיצה על כרטיסייה בזמן
// שתחום מסונן נשלחת כצמד (תחום, עסק), והשרת צובר — "מי שחיפש את התחום
// הזה הגיע אל הכרטיסים האלה" (ראו $lib/server/categoryClicks.js).
//
// הכתיבות שקטות, כמו מדידת החיפושים ($lib/searchTrack) — כשל מדידה לא
// נוגע בחוויית המשתמש. sendBeacon קודם ל-fetch: הלחיצה מנווטת מיד לדף
// העסק, והביקון שורד את המעבר גם בדפדפנים שקוטעים בקשות רגילות.
// ============================================================

import { browser } from '$app/environment';

const ENDPOINT = '/api/recos/track';

/** צמדים שכבר נשלחו בביקור הזה — לחיצה כפולה על אותו כרטיס אינה שתי המלצות */
const sent = new Set();

/**
 * הגולש פתח כרטיסייה מתוך תחום מסונן.
 * @param {string} category תווית התחום הפעיל
 * @param {string} businessId ה-documentId של הכרטיסייה
 */
export function trackCategoryClick(category, businessId) {
	if (!browser) return;
	const c = String(category ?? '')
		.replace(/\s+/g, ' ')
		.trim();
	const id = String(businessId ?? '').trim();
	if (c.length < 2 || c === 'all' || !id) return;
	const key = `${c}|${id}`;
	if (sent.has(key)) return;
	sent.add(key);

	const body = JSON.stringify({ events: [{ c, id }] });
	try {
		if (navigator.sendBeacon) {
			const blob = new Blob([body], { type: 'application/json' });
			if (navigator.sendBeacon(ENDPOINT, blob)) return;
		}
	} catch {
		/* נופלים ל-fetch */
	}
	void fetch(ENDPOINT, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body,
		keepalive: true
	}).catch(() => {
		/* כשל שקט */
	});
}
