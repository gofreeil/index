// ============================================================
// "אלה התגיות שכדאי לך" — הצעות לבעל העסק מתוך מה שהוא עצמו מילא בטופס
//
// בעל עסק שמתבקש לרשום תגיות עומד מול תיבה ריקה, ורושם שתיים-שלוש מילים
// שהוא ממילא כבר רשם בשם העסק. המילים שחסרות הן בדיוק אלה שהוא לא חושב
// עליהן — הנרדפות שהגולש מקליד ("שרברב" למי שכתב "אינסטלציה"), העיר
// שבה הוא עובד, והביטויים שגולשים באתר הזה באמת חיפשו החודש.
//
// לכן ההצעות נבנות מארבעה מקורות, בסדר עדיפות יורד:
//   1. חיפושים אמיתיים באתר — ביטוי שגולשים כבר הקלידו והוא נוגע בטיוטה.
//      חזק מכולם: זו לא השערה על מה שמחפשים אלא מה שנמדד.
//   2. נרדפות המקצוע ($lib/searchSuggest) — אותה טבלה שמצילה חיפוש שלא
//      החזיר תוצאות; כאן היא מונעת ממנו להיווצר מלכתחילה.
//   3. הטקסט של הטיוטה עצמה — תת-התחום והתיאור, ומילות המפתח של התחום
//      שנבחר בצורה שבה בעל העסק כתב אותן בפועל (הטקסונומיה מחזיקה שורשים,
//      "שיפוצ", ולא מילים שאפשר להציג).
//   4. גיאוגרפיה — עיר, שכונה, אזור מכירה וסניפים. "חשמלאי בית שמש" הוא
//      חיפוש נפוץ בהרבה מ"חשמלאי".
//
// שם העסק מטופל בנפרד ובחשדנות: הוא המקום שבו יושבים שמות פרטיים ושמות
// משפחה ("סטודיו רות", "משרד רואי חשבון כהן"), ותגית "#רות" לא תביא לאף
// אחד לקוח. משם נלקחת רק מילה שהיא בעצמה מקצוע מוכר.
//
// כל ההצעות מוצגות בצורה שבה הן נכתבו. הנרמול (שמקפל אותיות סופיות,
// "מזגנים"→"מזגנימ") משמש להשוואה בלבד ולעולם לא לתצוגה.
//
// המודול טהור ורץ בדפדפן, על מה שמוקלד עכשיו — בלי סבב שרת בכל הקלדה.
// ============================================================

import { CATEGORY_DEFS, normCategoryLabel as norm } from './categories.js';
import { SYNONYM_WORDS, STOP, words, akin } from './searchSuggest.js';
import { cleanTag, MAX_TAG_LEN } from './tags.js';

/** כמה הצעות מוצגות. מעבר לזה זו רשימה שסורקים במקום לבחור ממנה. */
const LIMIT = 12;

/** אותיות שימוש בראש מילה — "בעסק" הוא "עסק" גם לצורך סינון הרעש */
const PREFIX_LETTERS = 'הבלומשכ';

/**
 * מילים שהן רעש בתגית גם כשהן חוזרות בטקסט: פעלים כלליים, מילות קישור,
 * סופרלטיבים ומילות מסגרת של שם עסק ("משרד", "סטודיו"). STOP של החיפוש
 * מכסה את צד הגולש; אלה נוספות עליו מצד הטקסט שבעל העסק כותב על עצמו.
 */
const NOISE = new Set(
	[
		'שלנו',
		'שלכם',
		'אנחנו',
		'אנו',
		'אני',
		'הוא',
		'היא',
		'הכי',
		'כל',
		'כלל',
		'לכל',
		'גם',
		'אחרי',
		'לפני',
		'בכל',
		'בתוך',
		'תוך',
		'יותר',
		'הרבה',
		'מאוד',
		'כאן',
		'כמו',
		'איכות',
		'איכותי',
		'איכותית',
		'מקצועיות',
		'אמינות',
		'אמין',
		'אמינה',
		'מהיר',
		'מהירה',
		'זמין',
		'זמינה',
		'שנות',
		'שנים',
		'ניסיון',
		'לקוח',
		'לקוחות',
		'מחיר',
		'מחירים',
		'הנחה',
		'הטבה',
		'הנחות',
		'חינם',
		'ללא',
		'בלי',
		'אפשר',
		'אפשרות',
		'מגוון',
		'סוגי',
		'סוג',
		'תחום',
		'תחומי',
		'נותן',
		'נותנת',
		'מספק',
		'מספקת',
		'עושה',
		'עובד',
		'עובדת',
		'עבודה',
		'עבודות',
		'קהילה',
		'חברי',
		'חבר',
		'ארצי',
		'הארץ',
		'בארץ',
		// מילות מסגרת של שמות עסקים — הן לא המקצוע
		'משרד',
		'סטודיו',
		'מרכז',
		'קבוצת',
		'קבוצה',
		'סניף',
		'רשת',
		'בית',
		'בעלי'
	].map(norm)
);

/** מילה שאין טעם להציע כתגית בפני עצמה. הצורה בלי אות שימוש נבדקת גם היא —
 *  אחרת "העסק" חמק מבעד ל-"עסק" שברשימה. @param {string} w מילה מנורמלת */
function isNoise(w) {
	if (w.length < 3 || /^\d+$/.test(w)) return true;
	const forms = PREFIX_LETTERS.includes(w[0]) && w.length > 3 ? [w, w.slice(1)] : [w];
	return forms.some((f) => STOP.has(f) || NOISE.has(f));
}

/**
 * ו' החיבור בראש מילה באמצע רשימה ("הנהלת חשבונות ומיסים") היא חלק
 * מהרשימה ולא מהמילה, ו"#ומיסים" נראית כמו שגיאת הקלדה. ההסרה זהירה
 * בכוונה: רק על מילה שאינה הראשונה בביטוי, ורק כשמה שנשאר הוא מקצוע
 * מוכר — כך "ורד" ו"וילונות" נשארים כמו שהם.
 * @param {string} raw @param {boolean} midPhrase
 */
function deconjunct(raw, midPhrase) {
	if (!midPhrase || raw[0] !== 'ו' || raw.length < 4) return raw;
	const bare = norm(raw.slice(1));
	return PROFESSION_KEYS.some((p) => akin(bare, p)) ? raw.slice(1) : raw;
}

/** פירוק טקסט למילים, כל אחת עם צורת ההשוואה שלה לצד הצורה שנכתבה.
 *  @param {unknown} s @returns {{raw: string, key: string}[]} */
function splitRaw(s) {
	return String(s ?? '')
		.split(/[^\p{L}\p{N}']+/u)
		.filter(Boolean)
		.map((raw) => ({ raw, key: norm(raw) }))
		.filter((w) => w.key);
}

/** הטקסונומיה, מנורמלת פעם אחת בטעינת המודול */
const DOMAIN_KEYS = CATEGORY_DEFS.map((c) => ({
	label: c.label,
	key: norm(c.label),
	aliases: (c.aliases ?? []).map(norm),
	match: (c.match ?? []).map(norm).filter(Boolean)
}));

/**
 * אוצר המילים של המקצועות — כל הנרדפות וכל מילות המפתח של הטקסונומיה,
 * מנורמל. זה המסנן שמפריד בשם העסק בין "אינסטלציה" ל"אבי".
 */
const PROFESSION_KEYS = [
	...new Set([
		...SYNONYM_WORDS.flat().flatMap((w) => norm(w).split(' ')),
		...DOMAIN_KEYS.flatMap((d) => d.match)
	])
].filter(Boolean);

/**
 * @typedef {Object} TagDraft הטיוטה כפי שמולאה בטופס עד עכשיו
 * @property {string} [name]
 * @property {string} [category]
 * @property {string} [subcategory]
 * @property {string} [description] "תיאור מורחב"
 * @property {string} [discount]
 * @property {string} [city]
 * @property {string} [neighborhood]
 * @property {string} [salesArea]
 * @property {{city?: string, neighborhood?: string, address?: string}[]} [branches]
 */

/**
 * @typedef {Object} TagSuggestOptions
 * @property {string[]} [chosen] תגיות שכבר נבחרו — לא מוצעות שוב
 * @property {string[]} [queries] ביטויים שגולשים חיפשו באתר, מהנפוץ לנדיר
 * @property {string[]} [popular] תגיות נפוצות אצל עסקים אחרים במאגר
 * @property {number} [limit]
 */

/**
 * התגיות שכדאי לבעל העסק להוסיף, מהחזקה לחלשה.
 * @param {TagDraft} draft
 * @param {TagSuggestOptions} [options]
 * @returns {string[]}
 */
export function suggestTags(draft, options = {}) {
	const { chosen = [], queries = [], popular = [], limit = LIMIT } = options;

	const name = String(draft?.name ?? '');
	const subcategory = String(draft?.subcategory ?? '');
	const category = String(draft?.category ?? '');
	const description = String(draft?.description ?? '');
	const discount = String(draft?.discount ?? '');

	const nameWords = splitRaw(name);
	const subWords = splitRaw(subcategory);
	const bodyWords = [...splitRaw(description), ...splitRaw(discount), ...splitRaw(category)];
	const allWords = [...nameWords, ...subWords, ...bodyWords];
	if (!allWords.length) return [];
	const allKeys = allWords.map((w) => w.key);
	const allText = norm(`${name} ${subcategory} ${category} ${description} ${discount}`);

	/** האם המילה נוגעת בטיוטה בכלל @param {string} key מילה מנורמלת */
	const touchesDraft = (key) => allKeys.some((x) => akin(x, key));
	/** האם הביטוי (שיכול להיות רב-מילים) נוגע בטיוטה @param {string} phrase */
	const phraseTouches = (phrase) => {
		const parts = words(phrase);
		if (!parts.length) return false;
		if (allText.includes(norm(phrase))) return true;
		// כל מילה מהותית בביטוי חייבת להופיע — אחרת "לק ג׳ל" היה נופל על כל
		// מי שהמילה "ג׳ל" מופיעה אצלו במקרה
		return parts.filter((p) => !isNoise(p)).every((p) => touchesDraft(p));
	};

	/** @type {Map<string, {tag: string, score: number}>} */
	const found = new Map();
	const taken = new Set(chosen.map((t) => norm(cleanTag(t))));

	/** @param {string} raw @param {number} score */
	function add(raw, score) {
		const tag = cleanTag(raw);
		if (!tag || tag.length < 2 || tag.length > MAX_TAG_LEN) return;
		const parts = words(tag);
		// צירוף נשפט על כלל מילותיו; מילה בודדת חייבת לשאת מידע בעצמה
		if (!parts.length || parts.every((p) => isNoise(p))) return;
		const key = norm(tag);
		if (taken.has(key)) return;
		const cur = found.get(key);
		// הצורה הראשונה שנרשמה היא זו שתוצג — ההצעות החזקות נבדקות ראשונות,
		// והן מגיעות מהמקור שכתב את המילה בצורה המלאה שלה
		if (!cur) found.set(key, { tag, score });
		else if (score > cur.score) cur.score = score;
	}

	// ── 1. מה שגולשים באמת חיפשו כאן ──────────────────────────
	// המיקום ברשימה הוא הפופולריות, ולכן הוא חלק מהניקוד: ביטוי מוביל
	// שווה יותר מביטוי שנשאל פעמיים.
	queries.slice(0, 60).forEach((q, i) => {
		const tag = cleanTag(q);
		if (tag && phraseTouches(tag)) add(tag, 30 - Math.min(i, 20) * 0.5);
	});

	// ── 2. נרדפות המקצוע ─────────────────────────────────────
	// כל קבוצה שנגענו בה מביאה איתה את *כל* חברותיה — הערך של התגית הוא
	// דווקא במילה שבעל העסק לא כתב, כי היא זו שהגולש מקליד.
	for (const group of SYNONYM_WORDS) {
		const present = (/** @type {string} */ entry) => {
			const key = norm(entry);
			return key.includes(' ') ? allText.includes(key) : touchesDraft(key);
		};
		if (!group.some(present)) continue;
		// מילה שכבר מופיעה בטקסט מוצעת גם היא, אבל אחרי החסרות
		for (const entry of group) add(entry, present(entry) ? 14 : 22);
	}

	// ── 3א. מילות המפתח של התחום, בצורה שבה הן נכתבו בפועל ───
	// הטקסונומיה מחזיקה שורשים ("שיפוצ", "אינסטלצ") שאי אפשר להציג כמות
	// שהם, ולכן שורש שנוגע בטיוטה מוחזר כמילה השלמה שבעל העסק עצמו הקליד.
	// שורש שלא נמצא בטקסט פשוט נופל — "#שיפוצ" אינה תגית.
	const domain =
		DOMAIN_KEYS.find((d) => d.key === norm(category) || d.aliases.includes(norm(category))) ??
		DOMAIN_KEYS.find((d) => d.match.some((m) => allText.includes(m)));
	for (const m of domain?.match ?? []) {
		if (m.includes(' ')) {
			if (allText.includes(m)) add(m, 16);
			continue;
		}
		const hit = allWords.find((w) => w.key.startsWith(m) || m.startsWith(w.key));
		if (hit) add(hit.raw, 18);
	}
	if (domain) add(domain.label, 6);

	// ── 3ב. המילים והצירופים של הטיוטה עצמה ──────────────────
	// תת-התחום הוא המקום שבו כתוב המקצוע במילים של העסק, ולכן ממנו נלקחים
	// הצירופים ("עיצוב שיער", "הנהלת חשבונות") — ומילה בודדת רק כשהיא לא
	// הראש של צירוף כזה: "הנהלת" לבדה אינה תגית, והצירוף כבר נוסף.
	subWords.forEach((w, i) => {
		const next = subWords[i + 1];
		const heads = next && !isNoise(w.key) && !isNoise(next.key);
		if (heads) add(`${w.raw} ${next.raw}`, 20);
		else add(deconjunct(w.raw, i > 0), 15);
	});
	// מהשם — רק מילה שהיא בעצמה מקצוע. שם העסק מלא בשמות פרטיים ובמילות
	// מסגרת, ו"#כהן" או "#רות" לא יביאו לאף אחד לקוח.
	for (const w of nameWords) {
		if (PROFESSION_KEYS.some((p) => akin(w.key, p))) add(w.raw, 15);
	}
	// מהתיאור — רק מילה שחוזרת בו. טקסט שיווקי ארוך מלא במילים חד-פעמיות.
	/** @type {Map<string, {raw: string, n: number}>} */
	const freq = new Map();
	for (const w of splitRaw(description)) {
		if (isNoise(w.key)) continue;
		const cur = freq.get(w.key);
		if (cur) cur.n++;
		else freq.set(w.key, { raw: w.raw, n: 1 });
	}
	for (const { raw, n } of freq.values()) if (n >= 2) add(raw, 9 + Math.min(n, 4));

	// ── 4. גיאוגרפיה ─────────────────────────────────────────
	// העיר של הכרטיסייה חזקה: "חשמלאי בית שמש" הוא חיפוש שלם, ובלי
	// התגית הזאת העסק מסתמך על כך שהעיר תופיע בכתובת.
	add(String(draft?.city ?? ''), 21);
	add(String(draft?.neighborhood ?? ''), 11);
	for (const b of draft?.branches ?? []) add(String(b?.city ?? ''), 13);
	for (const w of splitRaw(draft?.salesArea)) add(w.raw, 12);

	// ── 5. תגיות שכבר בשימוש במאגר ───────────────────────────
	// מאחדות את השפה בין כרטיסיות, וכך חיפוש אחד מחזיר את כולן.
	for (const p of popular.slice(0, 80)) {
		const tag = cleanTag(p);
		if (tag && phraseTouches(tag)) add(tag, 10);
	}

	return [...found.values()]
		.sort((a, b) => b.score - a.score || a.tag.length - b.tag.length)
		.slice(0, limit)
		.map((s) => s.tag);
}
