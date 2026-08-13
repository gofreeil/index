// ============================================================
// tagPool.js — התגיות שכבר בשימוש במאגר
//
// כשבעל עסק חדש מקבל הצעות לתגיות, כדאי שחלקן יהיו התגיות שכרטיסיות
// אחרות כבר נושאות: שתי מספרות שרשמו "תספורת" ו"תספורות" מפצלות את אותו
// חיפוש לשתי תוצאות חלקיות, ואילו שתיים שרשמו את אותה מילה חוזרות יחד.
//
// המאגר קטן (מאות כרטיסיות) ונשלף בשליפה אחת של עמודת ה-json בלבד, עם
// מטמון של 10 דקות בזיכרון — טופס ההגשה נטען לעיתים רחוקות, ואין סיבה
// לשלם על השליפה בכל טעינה. כל כשל שקט: בלי הרשימה ההצעות עדיין עובדות
// מהטיוטה, מהטקסונומיה ומהנרדפות.
// ============================================================

import { listBusinessExtraFields } from './strapi.js';
import { parseTags, tagKey } from '../tags.js';

const TTL_MS = 10 * 60 * 1000;

/** @type {{ at: number, tags: string[] } | null} */
let cache = null;

/**
 * התגיות הנפוצות במאגר, מהנפוצה לנדירה.
 * @param {number} [limit]
 * @returns {Promise<string[]>}
 */
export async function getPopularTags(limit = 120) {
	if (cache && Date.now() - cache.at < TTL_MS) return cache.tags.slice(0, limit);
	try {
		const rows = await listBusinessExtraFields();
		/** @type {Map<string, {label: string, count: number}>} */
		const counts = new Map();
		for (const row of rows) {
			for (const tag of parseTags(row?.extra_fields?.tags)) {
				const key = tagKey(tag);
				if (!key) continue;
				const cur = counts.get(key);
				if (cur) cur.count++;
				else counts.set(key, { label: tag, count: 1 });
			}
		}
		const tags = [...counts.values()]
			.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'he'))
			.map((t) => t.label);
		cache = { at: Date.now(), tags };
		return tags.slice(0, limit);
	} catch (e) {
		console.error('[tagPool] load failed:', e instanceof Error ? e.message : e);
		return cache?.tags.slice(0, limit) ?? [];
	}
}
