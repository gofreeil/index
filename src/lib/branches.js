// ============================================================
// סניפים ומקומות שירות נוספים
//
// לכרטיסייה יש כתובת אחת בלבד. עסק עם יותר ממקום אחד — סניף שני, מחסן,
// קליניקה בעיר אחרת — נאלץ עד היום לדחוס את כולם לשורת כתובת אחת, ולכן
// אף מקום מלבד הראשון לא הגיע למפה ולא היה קריא בכרטיסייה.
//
// הרשימה נשמרת ב-extra_fields.branches — עמודת ה-json שכבר מחזיקה את
// אימייל הבעלים — כי לאוסף idx-business אין עמודה משלה ו-Strapi מתעלם
// בשקט ממפתח לא מוכר (כך אבד בעבר האימייל מטופס ההגשה).
//
// הטופס שולח את הרשימה כ-JSON בשדה מוסתר יחיד ולא כשדות חוזרים: שחזור
// הטיוטה מדלג על שם שחוזר כמה פעמים (ראו applyToForm ב-formDraft.ts),
// ושדה אחד עובר בו כמו כל שדה רגיל.
// ============================================================

/** מכסה — טופס, לא מאגר סניפים. */
export const MAX_BRANCHES = 10;

/** @typedef {{city: string, neighborhood: string, address: string}} Branch */

const MAX_LEN = 200;

/** @param {unknown} v */
const str = (v) => (typeof v === 'string' ? v.trim().slice(0, MAX_LEN) : '');

/**
 * מנקה רשימת מקומות מכל מקור — JSON מהטופס, מערך מ-extra_fields, או ערך
 * שבור לגמרי. תמיד מחזיר מערך: מקום פגום מושמט ולא מפיל את השמירה.
 * @param {unknown} raw
 * @returns {Branch[]}
 */
export function parseBranches(raw) {
	/** @type {any} */
	let list = raw;
	if (typeof raw === 'string') {
		try {
			list = JSON.parse(raw || '[]');
		} catch {
			return [];
		}
	}
	if (!Array.isArray(list)) return [];
	return list
		.map((b) => ({
			city: str(b?.city),
			neighborhood: str(b?.neighborhood),
			address: str(b?.address)
		}))
		.filter((b) => b.city || b.neighborhood || b.address)
		.slice(0, MAX_BRANCHES);
}

/**
 * מקום בשורה אחת, מהמדויק לכללי. שדות ריקים לא משאירים פסיקים יתומים.
 * @param {Partial<Branch> | null | undefined} b
 */
export function branchLine(b) {
	return [b?.address, b?.neighborhood, b?.city]
		.map((v) => String(v ?? '').trim())
		.filter(Boolean)
		.join(', ');
}

/**
 * כל הטקסט הגיאוגרפי של המקומות הנוספים — למי שסורק שמות יישובים
 * (ראו serviceArea.js). השכונה לא נכללת: היא לא יישוב.
 * @param {unknown} branches
 */
export function branchesGeoText(branches) {
	return parseBranches(branches)
		.map((b) => [b.city, b.address].filter(Boolean).join(' '))
		.join(' ')
		.trim();
}
