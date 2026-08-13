// ============================================================
// ותק באתר — כמה זמן בעל העסק כבר אצלנו
//
// נקודת ההתחלה היא תאריך העלאת הכרטיסייה (createdAt של הרשומה ב-Strapi,
// שנחשף כ-created_at ב-businessShape.js) ולא תאריך פתיחת החשבון: רוב
// הכרטיסיות הוזרמו בייבוא, ובעליהן נרשמו ודרשו אותן הרבה אחרי שהעסק כבר
// הופיע במדריך. ספירה מרגע ההרשמה הייתה מוחקת להם את כל השנים האלה.
// למשתמש שיש לו כמה כרטיסיות נספרת הוותיקה שבהן — הוותק הוא שלו, לא של
// כרטיסייה מסוימת.
//
// נקודת אפס אחת לכל מה שכבר היה במאגר (TENURE_EPOCH): 90 מ-95 הכרטיסיות
// נוצרו ב-Strapi באותה שנייה — הרגע שבו סקריפט הייבוא הזרים אותן מהגיליון,
// ולא היום שבו העסק באמת הצטרף. חותמת כזו אינה ותק אלא מועד מיגרציה, ולכן
// כל מה שהיה במאגר ביום שהמנייה נפתחה מתחיל למנות מאותו יום, וכל כרטיסייה
// שעולה מאז נושאת את התאריך האמיתי שלה. חותמת מפורשת ב-extra_fields.joined_at
// גוברת על שתיהן — שם, ורק שם, אפשר להחזיר לעסק ותיק את תאריך ההגשה המקורי.
//
// נוסח הזמן נבנה כאן ולא ב-i18n.js: זו נטייה דקדוקית ולא מחרוזת קבועה —
// יחיד/זוגי/רבים בעברית ("חודש", "חודשיים", "3 חודשים"), שלוש צורות
// ברוסית, וגם המקף שנספח ל-ו' רק לפני ספרה ("שנה ו-3 חודשים" מול "שנה
// וחודשיים"). התוויות שמסביב (tenureLabel/tenureNew/tenureSince) יושבות
// ב-i18n.js כמו כל טקסט אחר.
// ============================================================

const LOCALE = /** @type {Record<string, string>} */ ({ he: 'he-IL', en: 'en-US', ru: 'ru-RU' });

/**
 * היום שבו נפתחה מניית הוותק. כרטיסייה שנוצרה לפניו (כלומר: כל מה שהוזרם
 * בייבוא) מתחילה למנות מכאן — ראו הסבר בראש הקובץ. תאריך קבוע ולא "היום",
 * אחרת הוותק היה מתאפס בכל טעינה.
 */
export const TENURE_EPOCH = '2026-08-13T00:00:00.000Z';
const EPOCH_MS = Date.parse(TENURE_EPOCH);

/**
 * חותמת זמן → Date, או null לערך ריק/פגום. חלק מהכרטיסיות הישנות הגיעו
 * בייבוא בלי חותמת בכלל, ואסור שזה יפיל את הדף.
 * @param {unknown} raw
 * @returns {Date|null}
 */
export function parseStamp(raw) {
	if (!raw) return null;
	const d = new Date(String(raw));
	return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * תחילת הוותק של כרטיסייה שנשענת על מועד היצירה שלה: מה שנוצר לפני פתיחת
 * המנייה מתחיל ממנה, ומה שעלה מאז נספר מהיום שבו עלה. גם רשומה בלי חותמת
 * תקינה מקבלת את נקודת האפס — היא נמצאת במאגר, וזה מה שידוע עליה.
 * @param {unknown} createdAt
 * @returns {string} ISO
 */
export function tenureStartFrom(createdAt) {
	const d = parseStamp(createdAt);
	return !d || d.getTime() < EPOCH_MS ? TENURE_EPOCH : d.toISOString();
}

/**
 * החותמת המוקדמת ביותר ברשימה — הוותק של משתמש עם כמה כרטיסיות.
 * @param {unknown[]} stamps
 * @returns {string} ISO של המוקדמת, או '' כשאין אף חותמת תקינה
 */
export function earliestStamp(stamps) {
	let best = /** @type {Date|null} */ (null);
	for (const s of stamps || []) {
		const d = parseStamp(s);
		if (d && (!best || d < best)) best = d;
	}
	return best ? best.toISOString() : '';
}

/**
 * חודשים שלמים שעברו — לפי לוח השנה ולא לפי חלוקה ב-30 יום, כדי ש"שנה"
 * תיפול בדיוק על התאריך שבו הועלתה הכרטיסייה. תאריך עתידי (שעון שסטה)
 * נספר כאפס ולא כמספר שלילי.
 * @param {unknown} raw
 * @param {Date} [now]
 * @returns {number|null}
 */
export function tenureMonths(raw, now = new Date()) {
	const start = parseStamp(raw);
	if (!start) return null;
	let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
	// החודש האחרון נספר רק כשעבר בו יום העלאה מלא
	if (now.getDate() < start.getDate()) months--;
	return Math.max(0, months);
}

/** @param {number} n @param {[string, string, string]} forms יחיד / 2-4 / רבים */
const ruPlural = (n, forms) => {
	const mod10 = n % 10;
	const mod100 = n % 100;
	if (mod10 === 1 && mod100 !== 11) return forms[0];
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
	return forms[2];
};

/** נטיית היחידות לכל שפה, והחיבור בין שנים לחודשים */
const UNITS = {
	he: {
		/** @param {number} n */
		years: (n) => (n === 1 ? 'שנה' : n === 2 ? 'שנתיים' : `${n} שנים`),
		/** @param {number} n */
		months: (n) => (n === 1 ? 'חודש' : n === 2 ? 'חודשיים' : `${n} חודשים`),
		// "שנה ו-3 חודשים" אבל "שנה וחודשיים" — המקף נספח לו' רק לפני ספרה
		/** @param {string} a @param {string} b */
		join: (a, b) => `${a} ו${/^\d/.test(b) ? '-' : ''}${b}`
	},
	en: {
		/** @param {number} n */
		years: (n) => `${n} ${n === 1 ? 'year' : 'years'}`,
		/** @param {number} n */
		months: (n) => `${n} ${n === 1 ? 'month' : 'months'}`,
		/** @param {string} a @param {string} b */
		join: (a, b) => `${a}, ${b}`
	},
	ru: {
		/** @param {number} n */
		years: (n) => `${n} ${ruPlural(n, ['год', 'года', 'лет'])}`,
		/** @param {number} n */
		months: (n) => `${n} ${ruPlural(n, ['месяц', 'месяца', 'месяцев'])}`,
		/** @param {string} a @param {string} b */
		join: (a, b) => `${a}, ${b}`
	}
};

/**
 * @typedef {Object} Tenure
 * @property {number} months סך החודשים מאז ההעלאה
 * @property {number} years השנים המלאות שבתוכם
 * @property {string} text נוסח הוותק ("שנה ו-3 חודשים"); ריק בחודש הראשון
 * @property {string} since חודש ושנת ההעלאה ("מרץ 2024") — לטולטיפ
 * @property {boolean} isNew טרם מלאה חודש — מוצג כ"חדש באתר" ולא כמשך
 */

/**
 * כל מה שהתצוגה צריכה, בקריאה אחת. מחזיר null כשאין חותמת תקינה — ואז
 * פשוט אין תג ותק, בלי מציין מקום ובלי "לא ידוע".
 * @param {unknown} raw חותמת ההעלאה (created_at)
 * @param {string} [langCode] he/en/ru
 * @param {Date} [now]
 * @returns {Tenure|null}
 */
export function tenureInfo(raw, langCode = 'he', now = new Date()) {
	const start = parseStamp(raw);
	const months = tenureMonths(raw, now);
	if (!start || months === null) return null;

	const u = /** @type {any} */ (UNITS)[langCode] || UNITS.he;
	const years = Math.floor(months / 12);
	const rest = months % 12;
	// שנה שלמה ומעלה — החודשים נוספים רק כשיש מה להוסיף ("שנתיים" ולא
	// "שנתיים ו-0 חודשים")
	const text = years
		? rest
			? u.join(u.years(years), u.months(rest))
			: u.years(years)
		: months
			? u.months(months)
			: '';

	let since = '';
	try {
		since = start.toLocaleDateString(LOCALE[langCode] || 'he-IL', {
			month: 'long',
			year: 'numeric'
		});
	} catch {
		since = '';
	}

	return { months, years, text, since, isNew: months < 1 };
}
