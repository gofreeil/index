// ============================================================
// adsCode.js — קוד הבעלים לפרסום ללא תשלום, בצד השרת בלבד.
// הקוד עצמו לא נמצא בקוד המקור (המאגר ציבורי!) אלא במשתנה
// הסביבה ADS_OWNER_CODE. הדפדפן שולח את מה שהוקלד, והשרת:
//   1. מאמת מולו (verify-code + בזמן ההגשה עצמה — כך שאי אפשר
//      לזייף payment='code' בבקשה ישירה).
//   2. בכל שימוש בקוד — שולח הודעה לתיבת ההודעות של הבעלים
//      באתר קהילה בשכונה (אוסף messages ב-Strapi המשותף), עם
//      זהות המשתמש שהשתמש בקוד. נמען: ADS_NOTIFY_EMAIL.
// פורט מ-national-gemach (adsCode.ts).
// שליחת ההודעות עצמה עברה ל-adminNotify.js, המשותף לכל תורי האישור.
// ============================================================

import { env } from '$env/dynamic/private';
import {
	SITE_NAME,
	notifyAdmins,
	resolveOwnerUserId,
	sendMessages
} from '$lib/server/adminNotify.js';

/** @param {string} v */
function normalize(v) {
	return v.trim().replace(/\s+/g, ' ');
}

/** האם הטקסט שהוקלד הוא קוד הבעלים. אם ADS_OWNER_CODE לא הוגדר — תמיד לא.
 *  @param {unknown} raw */
export function isOwnerCode(raw) {
	const secret = normalize(env.ADS_OWNER_CODE ?? '');
	if (!secret) return false;
	return typeof raw === 'string' && normalize(raw) === secret;
}

/** הודעה על *כל* בקשת פרסום חדשה — לא רק על שימוש בקוד. בלי זה פרסומת
 *  נשמרה כ"ממתינה לאישור" בשקט ואיש לא ידע עליה.
 *  מפרסם ששב לשפר פרסומת קיימת מקבל ניסוח משלו: "עדכון" ולא "חדשה", כי
 *  האישור יחליף את הישנה במקום להוסיף פרסומת שנייה לצידה.
 *  @param {{ adTitle: string, durationDays: number, usedOwnerCode: boolean, submitter?: { name?: string | null, email?: string | null } | null, replacesTitle?: string, replacesLive?: boolean }} info */
export async function notifyAdminsNewAd(info) {
	const who = info.submitter?.email
		? `${info.submitter.name || 'ללא שם'} (${info.submitter.email})`
		: 'משתמש לא מחובר';
	// מפרסם חוזר ששיפר פרסומת קיימת: זו לא בקשה חדשה אלא שדרוג של אותה
	// פרסומת, והאישור מחליף את הישנה במקום להוסיף פרסומת שנייה לצידה.
	const isUpdate = Boolean(info.replacesTitle);
	const content =
		(isUpdate ? `🔄 עדכון לפרסומת קיימת — ${SITE_NAME}\n` : `📢 בקשת פרסום חדשה — ${SITE_NAME}\n`) +
		`פרסומת: "${info.adTitle}"\n` +
		(isUpdate
			? `הגרסה הקודמת: "${info.replacesTitle}"${info.replacesLive ? '' : ' (לא על האתר)'}\n`
			: '') +
		`מי שלח: ${who}\n` +
		`תקופה מבוקשת: ${info.durationDays === 180 ? 'חצי שנה' : 'חודש'}\n` +
		`תשלום: ${info.usedOwnerCode ? 'קוד בעלים' : 'ממתין לתשלום'}\n` +
		(isUpdate && info.replacesLive
			? `עם האישור הגרסה החדשה נכנסת במקום הישנה — אותו מקום בטור, אותו תאריך סיום, ורק הפרסומת הזו יורדת מהאתר. פרסומות אחרות של המפרסם לא מושפעות.\n`
			: '') +
		`המודעה ממתינה לאישור ב-index.gofreeil.com/admin/ads`;
	await notifyAdmins(content, 'new-ad notification');
}

/** הודעה לבעלים על שימוש בקוד — לתיבת ההודעות בקהילה בשכונה.
 *  כשל כאן לא מפיל את ההגשה.
 *  @param {{ adTitle: string, durationDays: number, submitter?: { name?: string | null, email?: string | null } | null }} info */
export async function notifyOwnerCodeUse(info) {
	try {
		const receiver = await resolveOwnerUserId();
		if (!receiver) {
			console.warn('adsCode: no notify recipient resolved — skipping owner notification');
			return;
		}
		const who = info.submitter?.email
			? `${info.submitter.name || 'ללא שם'} (${info.submitter.email})`
			: 'משתמש לא מחובר';
		const content =
			`📢 שימוש בקוד בעלים — ${SITE_NAME}\n` +
			`פרסומת: "${info.adTitle}"\n` +
			`מי השתמש: ${who}\n` +
			`תקופה מבוקשת: ${info.durationDays === 180 ? 'חצי שנה' : 'חודש'}\n` +
			`המודעה ממתינה לאישור ב-index.gofreeil.com/admin/ads`;
		await sendMessages([receiver], content);
	} catch (err) {
		console.warn('adsCode: owner notification failed', err instanceof Error ? err.message : err);
	}
}
