// ============================================================
// businessMerge.js — איחוד כמה רשומות של אותו עסק לרשומה אחת
//
// הגרסה החדשה ביותר נשארת ומקבלת את המיזוג (mergeBusinessVersions: מה
// שחסר בה נלקח מהקודמות), ורק אחרי שהעדכון נשמר — הקודמות נמחקות.
// כשל בעדכון = לא נמחק כלום. קבצי המדיה לא נמחקים לעולם.
// ============================================================

import { updateBusiness, deleteItem } from '$lib/server/strapi.js';
import { groupDuplicates, mergeBusinessVersions } from '$lib/businessDedupe.js';

/**
 * @param {any[]} records  רשומות Strapi של אותו עסק (עם logo/banners)
 * @returns {Promise<{keep: string, removed: number}>}
 */
export async function mergeBusinessRecords(records) {
	const byNewest = [...records].sort(
		(a, b) => new Date(b?.createdAt ?? 0).getTime() - new Date(a?.createdAt ?? 0).getTime()
	);
	const [keep, ...older] = byNewest;
	const patch = mergeBusinessVersions(byNewest, keep);
	if (Object.keys(patch).length) await updateBusiness(String(keep.documentId), patch);
	let removed = 0;
	for (const r of older) {
		try {
			await deleteItem('business', String(r.documentId));
			removed += 1;
		} catch (e) {
			// לשונית ניהול שנייה הספיקה למחוק אותה — זה בסדר
			console.warn('mergeBusinessRecords: delete failed', r.documentId, e);
		}
	}
	return { keep: String(keep.documentId), removed };
}

// הגשה טרייה עדיין עלולה להיות באמצע היישוב שלה (settleCreateRace בטופס
// ההגשה מוחק את הרשומה החדשה בכפילות מקבילה) — לא נוגעים בה עד שהוא נגמר,
// שלא יימחקו שתי הרשומות בבת אחת.
const SETTLE_MS = 2 * 60 * 1000;

/**
 * מיזוג אוטומטי של כל הכפילויות בתור הממתינים, בלי שאיש יצטרך ללחוץ.
 * @param {any[]} pending
 * @returns {Promise<number>} כמה רשומות כפולות אוחדו (ונמחקו)
 */
export async function autoMergePendingDuplicates(pending) {
	const now = Date.now();
	/** @type {Map<string, any>} */
	const byId = new Map(pending.map((b) => [String(b.documentId), b]));
	const seen = new Set();
	let merged = 0;
	for (const g of groupDuplicates(pending).values()) {
		if (g.size < 2 || seen.has(g.keepId)) continue;
		seen.add(g.keepId);
		const records = [g.keepId, ...g.others].map((id) => byId.get(id)).filter(Boolean);
		if (records.some((r) => now - new Date(r.createdAt ?? 0).getTime() < SETTLE_MS)) continue;
		try {
			merged += (await mergeBusinessRecords(records)).removed;
		} catch (e) {
			console.error('autoMergePendingDuplicates failed', g.keepId, e);
		}
	}
	return merged;
}
