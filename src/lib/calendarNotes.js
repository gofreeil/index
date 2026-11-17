// ─────────────────────────────────────────────────────────────
// calendarNotes.js — הערות היומן באזור האישי. קוד טהור, משותף ללקוח
// ולשרת (מיזוג בין מכשירים).
//
// כל הערה: { id, date: 'YYYY-MM-DD', time: 'HH:MM' | '', text, updatedAt, deleted }
// מיזוג לפי id — העדכון המאוחר מנצח. מחיקה היא מצבה (deleted) כדי שמכשיר
// אחר עם עותק ישן לא "יחיה" אותה; מצבות ישנות מ-60 יום נגרעות.
// ─────────────────────────────────────────────────────────────

const MAX = 500;
const TOMB_TTL = 60 * 86_400_000;

/**
 * @typedef {Object} CalNote
 * @property {string} id
 * @property {string} date
 * @property {string} time
 * @property {string} text
 * @property {number} updatedAt
 * @property {boolean} [deleted]
 */

/** @param {any} raw @returns {CalNote | null} */
function clean(raw) {
	if (!raw || typeof raw !== 'object') return null;
	const id = String(raw.id || '').slice(0, 40);
	const date = String(raw.date || '');
	if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
	const time = /^\d{2}:\d{2}$/.test(String(raw.time || '')) ? String(raw.time) : '';
	const updatedAt = Number(raw.updatedAt) || 0;
	const deleted = Boolean(raw.deleted);
	const text = deleted ? '' : String(raw.text || '').slice(0, 1000);
	if (!deleted && !text.trim()) return null;
	return { id, date, time, text, updatedAt, ...(deleted ? { deleted: true } : {}) };
}

/**
 * מאחד כמה רשימות להערה אחת לכל id (המאוחרת מנצחת).
 * @param {...any[]} lists
 * @returns {CalNote[]}
 */
export function mergeNotes(...lists) {
	/** @type {Map<string, CalNote>} */
	const byId = new Map();
	for (const list of lists) {
		if (!Array.isArray(list)) continue;
		for (const raw of list) {
			const n = clean(raw);
			if (!n) continue;
			const cur = byId.get(n.id);
			if (!cur || n.updatedAt > cur.updatedAt) byId.set(n.id, n);
		}
	}
	const cutoff = Date.now() - TOMB_TTL;
	return [...byId.values()]
		.filter((n) => !n.deleted || n.updatedAt > cutoff)
		.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
		.slice(-MAX);
}
