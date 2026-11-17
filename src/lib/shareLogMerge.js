// ─────────────────────────────────────────────────────────────
// shareLogMerge.js — איחוד רשימות "למי שלחתי". קוד טהור, משותף ללקוח
// (shareLog.js) ולשרת (server/shareLogStore.js): שני הצדדים חייבים למזג
// באותה דרך, אחרת הרשימה בשרת והרשימה בדפדפן היו מתרחקות זו מזו.
// ─────────────────────────────────────────────────────────────

export const SHARE_LOG_MAX = 200;

/**
 * @typedef {Object} ShareEntry
 * @property {string} key     מזהה הרשומה: כרטיסייה + מספר (גם מפתח הכפילות)
 * @property {string} wa      ספרות בפורמט בינלאומי, לקישור wa.me
 * @property {string} e164    פורמט בינלאומי עם +, לקישור sms:
 * @property {string} pretty  המספר כפי שמוצג למשתמש
 * @property {string} name    שם הנמען — נשאל רק אחרי השליחה, ולכן יכול להישאר ריק
 * @property {number} at      חותמת הזמן של השליחה האחרונה
 * @property {string} bizId
 * @property {string} bizName
 */

/** @param {any} e */
export const shareKeyOf = (e) => `${e?.bizId || ''}|${e?.wa || ''}`;

/**
 * שליחה חוזרת לאותו מספר מאותה כרטיסייה מעדכנת את התאריך במקום להוסיף
 * שורה — הטבלה היא "למי שלחתי", לא יומן ניסיונות. שם שכבר נשמר לא נמחק
 * על ידי שליחה מאוחרת שהגיעה בלי שם.
 * גם מנקה: רשומה בלי מספר נזרקת, ושדות נחתכים לאורך סביר — הפונקציה
 * רצה בשרת על קלט שהגיע מהדפדפן.
 * @param {any[]} list
 * @returns {ShareEntry[]}
 */
export function normalizeShareLog(list) {
	/** @type {Map<string, ShareEntry>} */
	const byKey = new Map();
	for (const raw of Array.isArray(list) ? list : []) {
		const wa = String(raw?.wa ?? '').replace(/\D/g, '');
		if (wa.length < 8 || wa.length > 15) continue;
		const entry = {
			key: '',
			wa,
			e164: String(raw.e164 || '').slice(0, 20),
			pretty: String(raw.pretty || raw.e164 || wa).slice(0, 30),
			name: String(raw.name || '')
				.trim()
				.slice(0, 60),
			at: Number(raw.at) || 0,
			bizId: String(raw.bizId || '').slice(0, 80),
			bizName: String(raw.bizName || '').slice(0, 120)
		};
		entry.key = shareKeyOf(entry);
		const prev = byKey.get(entry.key);
		if (!prev) byKey.set(entry.key, entry);
		else if (entry.at >= prev.at)
			byKey.set(entry.key, {
				...entry,
				name: entry.name || prev.name,
				bizName: entry.bizName || prev.bizName
			});
		else
			byKey.set(entry.key, {
				...prev,
				name: prev.name || entry.name,
				bizName: prev.bizName || entry.bizName
			});
	}
	return [...byKey.values()].sort((a, b) => b.at - a.at).slice(0, SHARE_LOG_MAX);
}
