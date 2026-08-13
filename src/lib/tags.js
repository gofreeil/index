// ============================================================
// תגיות הכרטיסייה — המילים שבהן מחפשים את העסק
//
// הקטגוריה היא תווית אחת מרשימה סגורה, ו"תת-תחום" הוא שורה חופשית אחת.
// בין השתיים נופלות כל שאר המילים שגולש באמת מקליד: מקצוע נרדף ("שרברב"
// למי שרשם "אינסטלציה"), שירות נקודתי ("פתיחת סתימות"), עיר, מותג. כל אחת
// מהן היא תגית, והחיפוש בדף הבית בודק אותן כמו שהוא בודק את שם העסק.
//
// נשמרות ב-extra_fields.tags — לאוסף idx-business אין עמודה משלהן,
// ו-Strapi מתעלם בשקט ממפתח לא מוכר (בדיוק כמו הסניפים והסלוגן).
//
// הטופס שולח אותן כ-JSON בשדה מוסתר יחיד ולא כשדות חוזרים: שחזור הטיוטה
// מדלג על שם שחוזר כמה פעמים (ראו applyToForm ב-formDraft.ts).
// ============================================================

import { normCategoryLabel } from './categories.js';

/** מכסה לכרטיסייה. מעבר לזה זו כבר רשימת מילות מפתח ולא תיאור של עסק. */
export const MAX_TAGS = 15;

/** תגית ארוכה מזה היא משפט, ולא מילה שמישהו מקליד בשורת חיפוש */
export const MAX_TAG_LEN = 30;

/**
 * ניקוי תגית בודדת: הסולמית מוסרת (היא קישוט של התצוגה, לא חלק מהערך),
 * סימני פיסוק בקצוות יורדים, ורווחים מכווצים. מחזיר מחרוזת ריקה לערך פסול.
 * @param {unknown} raw
 * @returns {string}
 */
export function cleanTag(raw) {
	return String(raw ?? '')
		.replace(/^[#\s]+/, '')
		.replace(/[\s,;]+$/, '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, MAX_TAG_LEN)
		.trim();
}

/** מפתח השוואה — "מזגנים" ו"מזגנים " הן אותה תגית. @param {string} tag */
export const tagKey = (tag) => normCategoryLabel(cleanTag(tag));

/**
 * מנקה רשימת תגיות מכל מקור: JSON מהטופס, מערך מ-extra_fields, או שורה
 * שהודבקה ("#חשמלאי #מזגנים" / "חשמלאי, מזגנים"). תמיד מחזיר מערך —
 * ערך פגום מושמט ולא מפיל את השמירה.
 * @param {unknown} raw
 * @returns {string[]}
 */
export function parseTags(raw) {
	/** @type {any} */
	let list = raw;
	if (typeof raw === 'string') {
		const text = raw.trim();
		if (!text) return [];
		if (text.startsWith('[')) {
			try {
				list = JSON.parse(text);
			} catch {
				return [];
			}
		} else {
			// לא JSON — שורה שהודבקה. פסיק וסולמית הם מפרידים; רווח לבדו אינו,
			// כי "מיזוג אוויר" היא תגית אחת.
			list = text.split(/[,;\n#]+/);
		}
	}
	if (!Array.isArray(list)) return [];

	/** @type {string[]} */
	const out = [];
	const seen = new Set();
	for (const item of list) {
		const tag = cleanTag(item);
		if (tag.length < 2) continue;
		const key = normCategoryLabel(tag);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		out.push(tag);
		if (out.length >= MAX_TAGS) break;
	}
	return out;
}

/** הערך שנוסע בשדה המוסתר של הטופס. @param {string[]} tags */
export const serializeTags = (tags) => JSON.stringify(parseTags(tags));

/** התגיות כשורת טקסט אחת — למנוע החיפוש. @param {unknown} tags */
export const tagsText = (tags) => parseTags(tags).join(' ');
