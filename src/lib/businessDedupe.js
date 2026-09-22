// ============================================================
// businessDedupe.js — "אותו עסק הוגש פעמיים" נתפס לפני שהוא הופך לשני כרטיסים
//
// הבעיה: לחיצה כפולה על "שליחת העסק לאישור", רענון אחרי שגיאת רשת, או
// הגשה חוזרת "ליתר ביטחון" — וכל פעם נוצרה רשומה חדשה ב-Strapi. בפאנל
// הניהול זה נראה כשלושה כרטיסים זהים של אותו עסק, וכל אחד מהם צריך
// טיפול נפרד. אותו דפוס תוקן ב"קהילה בשכונה": בקשה זהה שכבר ממתינה
// מתעדכנת במקום להיווצר שוב, והמגיש מקבל הודעה כנה ("כבר נשלחה").
//
// "אותו עסק" = אותו שם (בלי רגישות לרישיות, רווחים וסימני פיסוק) וגם
// אותו טלפון (לפי canonicalPhoneKey) או אותו אימייל של בעל העסק.
// שם בלבד לא מספיק — "מוסך הגליל" יכול להיות שני עסקים שונים; טלפון בלבד
// לא מספיק — לבעל עסק אחד יכולים להיות שני עסקים.
//
// הקובץ client-safe (בלי ייבוא server-only) כדי שהפאנל יוכל לקבץ כפילויות
// באותה הגדרה בדיוק שבה השרת מונע אותן.
// ============================================================

import { canonicalPhoneKey } from '$lib/phoneIL.js';

/**
 * שם עסק מנורמל להשוואה: רישיות, רווחים כפולים, גרשיים וסימני פיסוק
 * בקצוות לא מבדילים בין "קסם השמן" ל-"קסם השמן " או ל-'קסם השמן'.
 * @param {unknown} raw
 */
export function normalizeBizName(raw) {
	return String(raw ?? '')
		.toLowerCase()
		.replace(/["'`״׳]/g, '')
		.replace(/[\s\-_.,;:!?()[\]{}]+/g, ' ')
		.trim();
}

/** @param {any} b */
function ownerEmailOf(b) {
	return String(b?.extra_fields?.owner_email ?? b?.email ?? '')
		.trim()
		.toLowerCase();
}

/**
 * @typedef {Object} BizIdentity
 * @property {string} name
 * @property {string} [phone]
 * @property {string} [email]  אימייל בעל העסק (extra_fields.owner_email)
 */

/**
 * האם שתי רשומות/הגשות הן אותו עסק (ראו ההגדרה בראש הקובץ).
 * מקבל גם רשומת Strapi (עם extra_fields.owner_email) וגם ערכי טופס גולמיים.
 * @param {any} a @param {any} b
 */
export function isSameBusiness(a, b) {
	const name = normalizeBizName(a?.name);
	if (!name || name !== normalizeBizName(b?.name)) return false;
	const pa = canonicalPhoneKey(a?.phone);
	if (pa && pa === canonicalPhoneKey(b?.phone)) return true;
	const ea = ownerEmailOf(a);
	return Boolean(ea) && ea === ownerEmailOf(b);
}

/**
 * מפתח לנעילת הגשות מקבילות (שתי בקשות זהות שנכנסות באותה שנייה — לחיצה
 * כפולה — עוברות שתיהן את בדיקת "כבר קיים" לפני שהראשונה הספיקה להיכתב).
 * @param {BizIdentity} v
 */
export function submissionLockKey(v) {
	return `${normalizeBizName(v.name)}|${canonicalPhoneKey(v.phone)}|${String(v.email ?? '')
		.trim()
		.toLowerCase()}`;
}

/**
 * @typedef {Object} DupGroup
 * @property {number} size      כמה רשומות בקבוצה (1 = אין כפילות)
 * @property {string} keepId    ה-documentId של הרשומה הוותיקה ביותר — זו שנשארת
 * @property {string[]} others  ה-documentId של שאר הרשומות (הכפולים) — למחיקה
 * @property {number} ordinal   מקום הרשומה בקבוצה לפי תאריך (1 = הראשונה)
 */

/**
 * קיבוץ רשימת עסקים לקבוצות "אותו עסק". התוצאה: לכל documentId — הקבוצה שלו.
 * הרשומה הוותיקה ביותר (createdAt) היא זו שנשמרת; השאר כפולים.
 * O(n·k) עם k = מספר הקבוצות — הרשימה הממתינה קטנה (עד 200), זה זול.
 * @param {any[]} list
 * @returns {Map<string, DupGroup>}
 */
export function groupDuplicates(list) {
	/** @type {any[][]} */
	const groups = [];
	for (const b of list) {
		// מול כל חבר בכל קבוצה, ואיחוד קבוצות שהרשומה מגשרת ביניהן: א' ~ ב' לפי
		// טלפון ו-ב' ~ ג' לפי אימייל — שלושתן אותו עסק, גם אם א' ו-ג' לבדן לא
		// היו נתפסות, ובלי תלות בסדר שבו הרשומות הגיעו.
		const hits = groups.filter((grp) => grp.some((x) => isSameBusiness(x, b)));
		if (!hits.length) {
			groups.push([b]);
			continue;
		}
		for (const h of hits) groups.splice(groups.indexOf(h), 1);
		groups.push([...hits.flat(), b]);
	}
	/** @type {Map<string, DupGroup>} */
	const out = new Map();
	for (const g of groups) {
		const sorted = [...g].sort(
			(a, b) => new Date(a?.createdAt ?? 0).getTime() - new Date(b?.createdAt ?? 0).getTime()
		);
		const keepId = String(sorted[0]?.documentId ?? '');
		const others = sorted.slice(1).map((x) => String(x.documentId));
		sorted.forEach((x, i) => {
			out.set(String(x.documentId), { size: sorted.length, keepId, others, ordinal: i + 1 });
		});
	}
	return out;
}
