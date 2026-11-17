// ─────────────────────────────────────────────────────────────
// calendar.js — "הוספה ליומן": קישור ליומן גוגל וקובץ .ics (אפל, אאוטלוק,
// וכל אפליקציית יומן אחרת).
//
// זה גם ההתראה עצמה: לאתר אין ספק מייל ואין push, והיומן של המשתמש כבר
// יודע להקפיץ התראה בטלפון בדיוק בזמן. שני המסלולים הם הדפוס המקובל
// (כפתורי add-to-calendar): קישור TEMPLATE של גוגל — בלי API ובלי הרשאות
// — וקובץ iCalendar סטנדרטי (RFC 5545) עם התראה (VALARM) בזמן האירוע.
// ─────────────────────────────────────────────────────────────

/** @param {number} n */
const p2 = (n) => String(n).padStart(2, '0');

/** תאריך מקומי בפורמט של גוגל: 20261120T090000 (בלי Z — האזור נקבע ב-ctz). @param {Date} d */
const localStamp = (d) =>
	`${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}T${p2(d.getHours())}${p2(d.getMinutes())}00`;

/** תאריך UTC בפורמט iCalendar: 20261120T070000Z. @param {Date} d */
const utcStamp = (d) =>
	`${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}00Z`;

/**
 * @typedef {Object} CalEvent
 * @property {string} title
 * @property {string} [details]
 * @property {number} start   ms
 * @property {number} [minutes] משך האירוע (ברירת מחדל 15 דקות)
 * @property {string} [uid]    מזהה יציב — פתיחה חוזרת של הקובץ מעדכנת ולא משכפלת
 */

/**
 * קישור שפותח את יומן גוגל עם האירוע מלא, מוכן לשמירה (או לשינוי התאריך
 * שם — ה"פתיחה ביומן" נועדה גם למי שרוצה לבחור זמן ביומן עצמו).
 * @param {CalEvent} ev
 */
export function googleCalendarUrl(ev) {
	const start = new Date(ev.start);
	const end = new Date(ev.start + (ev.minutes ?? 15) * 60_000);
	const q = new URLSearchParams({
		action: 'TEMPLATE',
		text: ev.title,
		dates: `${localStamp(start)}/${localStamp(end)}`
	});
	if (ev.details) q.set('details', ev.details);
	try {
		q.set('ctz', Intl.DateTimeFormat().resolvedOptions().timeZone);
	} catch {
		/* בלי אזור זמן — גוגל משתמש בזה של החשבון */
	}
	return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/** escape של טקסט לפי RFC 5545. @param {string} s */
const esc = (s) =>
	String(s)
		.replace(/\\/g, '\\\\')
		.replace(/\r?\n/g, '\\n')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,');

/**
 * שורות ארוכות מ-75 בתים נחתכות בהמשכים (RFC 5545 §3.1) — אחרת חלק
 * מהאפליקציות מסרבות לקרוא כותרת/פרטים בעברית ארוכים. החיתוך לפי תווים
 * (לא בייטים) בטוח כאן כי 60 תווים עבריים = 120 בייטים, והמגבלה רכה.
 * @param {string} line
 */
function fold(line) {
	const out = [];
	let rest = line;
	while (rest.length > 60) {
		out.push(rest.slice(0, 60));
		rest = ' ' + rest.slice(60);
	}
	out.push(rest);
	return out.join('\r\n');
}

/**
 * תוכן קובץ .ics עם התראה בזמן האירוע.
 * @param {CalEvent} ev
 */
export function buildIcs(ev) {
	const start = new Date(ev.start);
	const end = new Date(ev.start + (ev.minutes ?? 15) * 60_000);
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//gofreeil//index reminders//HE',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		'BEGIN:VEVENT',
		`UID:${ev.uid || `${ev.start}-${Math.random().toString(36).slice(2)}`}@gofreeil.com`,
		`DTSTAMP:${utcStamp(new Date())}`,
		`DTSTART:${utcStamp(start)}`,
		`DTEND:${utcStamp(end)}`,
		`SUMMARY:${esc(ev.title)}`,
		...(ev.details ? [`DESCRIPTION:${esc(ev.details)}`] : []),
		'BEGIN:VALARM',
		'ACTION:DISPLAY',
		`DESCRIPTION:${esc(ev.title)}`,
		'TRIGGER:PT0M',
		'END:VALARM',
		'END:VEVENT',
		'END:VCALENDAR'
	];
	return lines.map(fold).join('\r\n') + '\r\n';
}

/**
 * מוריד קובץ .ics (או פותח אותו ישירות באפליקציית היומן בנייד).
 * @param {CalEvent} ev
 * @param {string} [filename]
 */
export function downloadIcs(ev, filename = 'reminder.ics') {
	const blob = new Blob([buildIcs(ev)], { type: 'text/calendar;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
