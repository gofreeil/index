// ============================================================
// adTrack.js — מדידת הפרסומות בצד הלקוח
// פורט מ-national-gemach/src/lib/adTrack.ts אל index.
// ------------------------------------------------------------
// המדדים מגיעים למפרסם באזור האישי (/profile) ולאדמין ב-/admin/stats.
//   • חשיפה (impressions) — נצברת ונשלחת במקובץ: מודעה נספרת פעם אחת לכל
//     ביקור, והשליחה היא אחת ל-20 שניות או ביציאה מהעמוד. כך סבב המודעות
//     בסרגל הצד לא מייצר בקשה בכל החלפה.
//   • קליק / דף נחיתה / פנייה — נשלחים מיד (sendBeacon, שורד ניווט).
// כל הכתיבות שקטות: כשל מדידה לא נוגע בחוויית המשתמש.
// ============================================================

import { browser } from '$app/environment';

/** @typedef {'impressions'|'clicks'|'landing'|'leads'} AdMetric */

const ENDPOINT = '/api/ads/track';
const BATCH_MS = 20_000;

/** מודעות שנספרו כבר בביקור הזה — בלי חשיפה כפולה לאותה מודעה */
const seenThisVisit = new Set();
/** חשיפות שעוד לא נשלחו */
const queued = new Set();
/** @type {ReturnType<typeof setTimeout>|undefined} */
let timer;
let exitHooked = false;

/** @param {{id: string, metric: AdMetric}[]} events */
function send(events) {
	if (!browser || events.length === 0) return;
	const payload = JSON.stringify({ events });
	try {
		if (navigator.sendBeacon) {
			const blob = new Blob([payload], { type: 'application/json' });
			if (navigator.sendBeacon(ENDPOINT, blob)) return;
		}
	} catch {
		/* נופלים ל-fetch */
	}
	void fetch(ENDPOINT, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: payload,
		keepalive: true
	}).catch(() => {
		/* כשל שקט */
	});
}

function flushImpressions() {
	if (timer) {
		clearTimeout(timer);
		timer = undefined;
	}
	if (queued.size === 0) return;
	const events = [...queued].map((id) => ({
		id: /** @type {string} */ (id),
		metric: 'impressions'
	}));
	queued.clear();
	send(/** @type {any} */ (events));
}

function hookExit() {
	if (!browser || exitHooked) return;
	exitHooked = true;
	// pagehide תופס סגירה/ניווט מחוץ לאתר; visibilitychange תופס מעבר-לשוניות
	// ומינימיזציה בנייד, שם pagehide לא בהכרח נורה.
	window.addEventListener('pagehide', flushImpressions);
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') flushImpressions();
	});
}

/** המודעה נראתה על המסך. חוזרת בשקט אם היא כבר נספרה בביקור הזה. @param {string|null|undefined} id */
export function markAdSeen(id) {
	if (!browser) return;
	const adId = (id ?? '').trim();
	if (!adId || seenThisVisit.has(adId)) return;
	seenThisVisit.add(adId);
	queued.add(adId);
	hookExit();
	if (!timer) timer = setTimeout(flushImpressions, BATCH_MS);
}

/** אירוע נקודתי — נשלח מיד, וגורר איתו את החשיפות שממתינות.
 * @param {string|null|undefined} id @param {AdMetric} metric */
export function trackAdEvent(id, metric) {
	if (!browser) return;
	const adId = (id ?? '').trim();
	if (!adId) return;
	flushImpressions();
	send([{ id: adId, metric }]);
}

/** קליק על המודעה (סרגל צד / באנר / מגירת נייד). @param {string|null|undefined} id */
export const trackAdClick = (id) => trackAdEvent(id, 'clicks');

/** צפייה בדף הנחיתה /ads/[id]. @param {string|null|undefined} id */
export const trackAdLanding = (id) => trackAdEvent(id, 'landing');

/** פנייה: טלפון / וואטסאפ / אתר / מייל בדף הנחיתה. @param {string|null|undefined} id */
export const trackAdLead = (id) => trackAdEvent(id, 'leads');
