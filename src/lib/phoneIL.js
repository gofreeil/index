// ─────────────────────────────────────────────────────────────
// phoneIL.js — נרמול ואימות של מספר טלפון שהוקלד ידנית.
//
// בעל עסק ששולח את הכרטיס למכר יקליד את המספר בכל צורה שעולה בדעתו:
// "050-123-4567", "+972 50 1234567", "0501234567", "972501234567",
// ואפילו "501234567" בלי האפס המוביל. wa.me מקבל רק ספרות בפורמט
// בינלאומי — בלי + ובלי אפס — ולכן כל ההמרות מרוכזות כאן, ולא בתוך
// הרכיב שמרכיב את הקישור.
// ─────────────────────────────────────────────────────────────

const IL_CC = '972';

/** נייד ישראלי בלי האפס: 5X + 7 ספרות. */
const IL_MOBILE = /^5\d{8}$/;
/** קווי ישראלי בלי האפס: 2/3/4/8/9 + 7 ספרות, או 07X (VoIP) + 7. */
const IL_LANDLINE = /^(?:[23489]\d{7}|7\d{8})$/;

/**
 * @typedef {Object} ParsedPhone
 * @property {boolean} ok            האם אפשר לשלוח למספר הזה
 * @property {string}  e164          פורמט בינלאומי עם + (לקישור sms:)
 * @property {string}  wa            ספרות בלבד בפורמט בינלאומי (לקישור wa.me)
 * @property {string}  pretty        תצוגה קריאה למשתמש
 * @property {''|'mobile'|'landline'|'intl'} kind
 * @property {''|'empty'|'short'|'landline'|'invalid'} error
 */

/** @type {ParsedPhone} */
const EMPTY = { ok: false, e164: '', wa: '', pretty: '', kind: '', error: 'empty' };

/**
 * מפרק מספר טלפון גולמי לצורה שאפשר לשלוח אליה.
 * @param {unknown} raw
 * @returns {ParsedPhone}
 */
export function parsePhoneIL(raw) {
	const trimmed = String(raw ?? '').trim();
	if (!trimmed) return { ...EMPTY };

	// "+" או "00" בתחילת המספר = הצהרה מפורשת על קידומת מדינה.
	const isIntlPrefixed = /^(?:\+|00)/.test(trimmed);
	let digits = trimmed.replace(/\D/g, '');
	if (!digits) return { ...EMPTY };
	if (isIntlPrefixed && digits.startsWith('00')) digits = digits.slice(2);

	// מכר בחו"ל — מעבירים את המספר כמו שהוא, בלי כללי הנייד הישראלי.
	if (isIntlPrefixed && !digits.startsWith(IL_CC)) {
		if (digits.length < 8 || digits.length > 15) {
			return { ...EMPTY, error: 'invalid' };
		}
		return {
			ok: true,
			e164: `+${digits}`,
			wa: digits,
			pretty: `+${digits}`,
			kind: 'intl',
			error: ''
		};
	}

	// מכאן — מספר ישראלי. מורידים קידומת מדינה ואפס מוביל ומשווים לתבניות.
	let local = digits;
	if (local.startsWith(IL_CC)) local = local.slice(IL_CC.length);
	local = local.replace(/^0+/, '');

	if (IL_MOBILE.test(local)) {
		return {
			ok: true,
			e164: `+${IL_CC}${local}`,
			wa: `${IL_CC}${local}`,
			pretty: `0${local.slice(0, 2)}-${local.slice(2, 5)}-${local.slice(5)}`,
			kind: 'mobile',
			error: ''
		};
	}

	// קווי הוא מספר תקין לגמרי — פשוט אין עליו וואטסאפ ואי אפשר לשלוח אליו SMS.
	if (IL_LANDLINE.test(local)) {
		return { ...EMPTY, kind: 'landline', error: 'landline' };
	}

	return { ...EMPTY, error: local.length < 9 ? 'short' : 'invalid' };
}

/**
 * מפתח השוואה בין שני מספרים שנכתבו בצורות שונות ("050-1234567" מול
 * "0501234567" מול "+972501234567"). בניגוד ל-parsePhoneIL כאן גם מספר
 * קווי מקבל מפתח — ההשוואה משמשת לזיהוי בעלות על כרטיסייה, לא לשליחה.
 * מחזיר '' למספר קצר מדי, כדי ששני ערכים ריקים לא "יתאימו" זה לזה.
 * @param {unknown} raw
 * @returns {string}
 */
export function canonicalPhoneKey(raw) {
	let d = String(raw ?? '').replace(/\D/g, '');
	if (!d) return '';
	if (d.startsWith('00')) d = d.slice(2);
	if (d.startsWith(IL_CC)) d = d.slice(IL_CC.length);
	d = d.replace(/^0+/, '');
	return d.length >= 8 ? d : '';
}
