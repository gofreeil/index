// ============================================================
// searchTrack.js — רישום מה חיפשו, מצד הדפדפן
//
// שורת החיפוש בדף הבית מסננת בכל הקלדה, ולכן "חיפוש" אינו אירוע אחד אלא
// זרם של מצבים. שני מנגנונים הופכים אותו לנתון קריא:
//
//   השהיה — נשלח רק מה שהוקלד ואז נעצר (DEBOUNCE_MS). מי שהקליד ברצף
//     "חשמלאי" מייצר שליחה אחת, לא שבע.
//   תיקון-לאחור — מי שעצר באמצע ("חשמ"), נשלח, והמשיך ל"חשמלאי", גורר
//     איתו replaces: הביטוי החלקי נגרע בשרת כשהמלא נרשם. בלי זה רשימת
//     "מה חיפשו" הייתה מלאה בקידומות של מילים.
//
// גם מספר התוצאות נשלח: ביטוי מבוקש שחוזר עם דף ריק הוא בדיוק רשימת
// בעלי המקצוע שכדאי לגייס לאינדקס.
//
// הכתיבות שקטות, כמו במדידת הפרסומות ($lib/adTrack) — כשל מדידה לא נוגע
// בחוויית המשתמש.
// ============================================================

import { browser } from '$app/environment';

const ENDPOINT = '/api/search/track';
const DEBOUNCE_MS = 1400;
/** ביטוי קצר מדי הוא הקלדה באמצע, לא חיפוש */
const MIN_LEN = 2;
/** אחרי זה כבר לא "אותה הקלדה", ותיקון-לאחור היה מוחק חיפוש אמיתי */
const REFINE_WINDOW_MS = 45_000;

/** @type {ReturnType<typeof setTimeout>|undefined} */
let timer;
/** @type {{q: string, zero: boolean}|null} */
let pending = null;
/** הביטוי האחרון שכבר נשלח בביקור הזה, מצב התוצאות שלו וזמן השליחה */
let lastSent = '';
let lastSentZero = false;
let lastSentAt = 0;
let exitHooked = false;

/** @param {any} payload */
function send(payload) {
	if (!browser) return;
	const body = JSON.stringify(payload);
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

function flush() {
	if (timer) {
		clearTimeout(timer);
		timer = undefined;
	}
	if (!pending) return;
	const { q, zero } = pending;
	pending = null;
	if (q === lastSent) return;

	// ההקלדה שהמשיכה את הביטוי הקודם מבטלת אותו — נשלח כזוג, והשרת גורע.
	// מצב התוצאות של הקודם נוסע איתו: הגריעה חייבת להוריד בדיוק את מה
	// שהוספה שלו הוסיפה.
	const refines =
		lastSent &&
		q !== lastSent &&
		q.startsWith(lastSent) &&
		Date.now() - lastSentAt < REFINE_WINDOW_MS;

	send({
		events: [{ q, zero, ...(refines ? { replaces: { q: lastSent, zero: lastSentZero } } : {}) }]
	});
	lastSent = q;
	lastSentZero = zero;
	lastSentAt = Date.now();
}

function hookExit() {
	if (!browser || exitHooked) return;
	exitHooked = true;
	// יציאה מהדף באמצע ההשהיה — הרגע שבו החיפוש האחרון (והמעניין ביותר,
	// כי הוא זה שהוביל להחלטה) היה הולך לאיבוד
	window.addEventListener('pagehide', flush);
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') flush();
	});
}

/**
 * הגולש חיפש. אפשר לקרוא בכל הקלדה — השליחה בפועל נדחית.
 * @param {string} query הביטוי כפי שהוקלד
 * @param {number} resultCount כמה תוצאות הוא החזיר
 */
export function trackSearch(query, resultCount) {
	if (!browser) return;
	const q = String(query ?? '')
		.replace(/\s+/g, ' ')
		.trim();
	if (q.length < MIN_LEN) return;
	pending = { q, zero: Number(resultCount) === 0 };
	hookExit();
	if (timer) clearTimeout(timer);
	timer = setTimeout(flush, DEBOUNCE_MS);
}
