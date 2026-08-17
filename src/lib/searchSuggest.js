// ============================================================
// "לא נמצא — אבל אלה הקרובים": מה מוצג כשחיפוש מחזיר אפס תוצאות.
//
// החיפוש בדף הבית הוא includes על מחרוזת גולמית, ולכן כל פער כתיב קטן מחזיר
// דף ריק: "אינסטלטור" לא נופל על "אינסטלציה", "מזגנים" לא נופל על "מזגן",
// "בשיפוצים" לא נופל על "שיפוצניק". גולש שקיבל דף ריק כמעט לא מנסה ניסוח
// שני — הוא עוזב, וזה בדיוק הרגע שבו יש באינדקס עסק שמתאים לו.
//
// שני מסלולים, ושניהם מצטברים לאותו ניקוד:
//   התאמה ישירה — מילה בכרטיסייה שחולקת שורש עם מילת החיפוש (שם > תת-תחום >
//     תחום > שאר הטקסט). מכסה נטיות, ריבוי ואותיות שימוש.
//   התאמת תחום — מילת החיפוש נופלת על מילות המפתח של הטקסונומיה
//     ($lib/categories), וכל עסק שיושב באותו תחום נחשב קרוב. מכסה מקצוע
//     שאף כרטיסייה לא כתבה במפורש ("שרברב" → תחום הבית והתחזוקה).
//
// התאמת התחום נבדקת מול הטקסט של הכרטיסייה ולא רק מול התווית שעליה, כי
// התווית המוצגת עשויה להיות שם שהסופר-אדמין נתן לתחום במסך הניהול.
//
// המודול טהור וחסר תלות בשרת — הוא רץ בדפדפן, על הרשימה שכבר נטענה.
// ============================================================

import { CATEGORY_DEFS, normCategoryLabel as norm } from './categories.js';

/** אורך מקטע הפתיחה המשותף שממנו שתי מילים נחשבות לאותו שורש */
const STEM = 4;

/** אותיות שימוש בראש מילה עברית — "בשיפוצים" הוא "שיפוצים" */
const PREFIX_LETTERS = 'הבלומשכ';

/**
 * מילים שאין בהן מידע על מקצוע. בלעדיהן "עסק לניקיון" היה נופל על "עסקי"
 * שבמילות המפתח של הייעוץ העסקי, ומחזיר יועצים למי שחיפש מנקה.
 */
export const STOP = new Set(
	[
		'בעל',
		'בעלי',
		'מקצוע',
		'מקצועי',
		'עסק',
		'עסקים',
		'שירות',
		'שירותי',
		'חברה',
		'חברת',
		'מחפש',
		'מחפשת',
		'צריך',
		'צריכה',
		'רוצה',
		'הכי',
		'טוב',
		'טובה',
		'זול',
		'מומלץ',
		'מומלצת',
		'באזור',
		'ליד',
		'אצל',
		'של',
		'עם'
	].map(norm)
);

/**
 * מילים נרדפות למקצוע. השוואת שורש מכסה נטיות ("מזגן"/"מזגנים") אבל לא
 * מילים שונות לאותו מקצוע: "שרברב" ו"אינסטלטור" לא חולקים אף אות, וגולש
 * שהקליד את הראשונה קיבל דף ריק אף שהאינסטלטור יושב באינדקס. כל קבוצה כאן
 * היא מעגל אחד — מספיק שמילת החיפוש נגעה באחת מהן כדי שכל השאר ייחשבו גם הן
 * מבוקשות (בניקוד מופחת, כי זו כבר לא המילה שהוקלדה).
 *
 * שתי גרסאות: SYNONYM_WORDS היא הרשימה כפי שנכתבה, ו-SYNONYM_GROUPS היא
 * אותה רשימה מנורמלת — זו שמשמשת להשוואה כאן. מנוע הצעת התגיות
 * ($lib/tagSuggest) צריך דווקא את הראשונה: הוא מציג את המילים לבעל העסק,
 * והנרמול (שמקפל אותיות סופיות) היה מציע לו "#מזגנימ".
 */
export const SYNONYM_WORDS = [
	['שרברב', 'אינסטלטור', 'אינסטלציה', 'צנרת', 'סתימות', 'ביוב', 'דוד שמש'],
	['חשמלאי', 'חשמל', 'לוח חשמל'],
	['מזגן', 'מיזוג', 'מזגנים', 'מיזוג אוויר'],
	['מנקה', 'ניקיון', 'ניקוי', 'נקיון', 'פוליש'],
	['הדברה', 'מדביר', 'מזיקים', 'ג׳וקים'],
	['מנעולן', 'מנעול', 'פריצת דלתות', 'פורץ מנעולים'],
	['גנן', 'גינון', 'גינה', 'דשא', 'גיזום'],
	['שיפוצניק', 'שיפוצים', 'שיפוץ', 'קבלן שיפוצים'],
	['נגר', 'נגרות', 'רהיטים', 'ארונות', 'מטבחים'],
	['מסגר', 'מסגרות', 'ריתוך', 'אלומיניום', 'פרזול'],
	['זגג', 'זכוכית', 'ויטרינה'],
	['טכנאי', 'תיקון', 'תיקונים', 'תקלה'],
	['מוביל', 'הובלה', 'הובלות', 'משאית', 'הסעות', 'מונית'],
	['צלם', 'צילום', 'צילומים', 'סטילס', 'וידאו'],
	// בלי "ספר" לבדה — "בית ספר" היה מחזיר מספרות
	['ספרית', 'מספרה', 'תספורת', 'מעצב שיער', 'עיצוב שיער'],
	['קוסמטיקאית', 'קוסמטיקה', 'טיפולי פנים', 'מכון יופי'],
	['מניקוריסטית', 'מניקור', 'ציפורניים', 'לק ג׳ל'],
	['עורך דין', 'עוד', 'משפטן', 'ייצוג משפטי', 'תביעה'],
	// בלי "רו״ח" — הנרמול מוריד את הגרשיים והיא הופכת ל"רוח", שגוררת את
	// כל מי שחיפש רוחניות אל רואי החשבון
	['רואה חשבון', 'הנהלת חשבונות', 'חשבונאות', 'מיסים', 'מס הכנסה'],
	['מתווך', 'תיווך', 'נדלן', 'דירות', 'משכנתא'],
	['סוכן ביטוח', 'ביטוח', 'פנסיה'],
	['מתכנת', 'תכנות', 'בניית אתרים', 'אתר אינטרנט', 'אפליקציה'],
	['מחשבים', 'מחשב', 'לפטופ', 'מדפסת'],
	['מורה', 'שיעורים', 'שיעורים פרטיים', 'מרצה', 'קורס'],
	['מאמן', 'אימון', 'קואצינג', 'קואצר', 'ליווי אישי'],
	// בלי "יועץ" לבדה — היא נמתחת מייעוץ עסקי ועד ייעוץ משכנתאות
	['פסיכולוג', 'מטפל רגשי', 'פסיכותרפיה', 'טיפול רגשי'],
	['דיאטנית', 'תזונאית', 'תזונה', 'ירידה במשקל'],
	['מעסה', 'עיסוי', 'מסאז', 'טיפול בגוף'],
	['שף', 'קייטרינג', 'בישול', 'אוכל מוכן'],
	['קונדיטורית', 'מאפייה', 'עוגות', 'מאפים', 'אפייה'],
	['די גיי', 'תקליטן', 'הגברה', 'מוזיקה לאירועים'],
	['מעצבת פנים', 'עיצוב פנים', 'הום סטיילינג'],
	['גרפיקאי', 'עיצוב גרפי', 'לוגו', 'מיתוג'],
	['שיווק', 'פרסום', 'קידום אתרים', 'סושיאל', 'קמפיין']
];

/** אותן קבוצות, מנורמלות — הצורה שבה החיפוש משווה אותן. */
const SYNONYM_GROUPS = SYNONYM_WORDS.map((g) => [...new Set(g.map(norm).filter(Boolean))]);

/**
 * ראשי תיבות שהנרמול (שמוריד גרשיים) משטח למילה אחרת לגמרי: רו"ח → "רוח",
 * עו"ד → "עוד". הם מזוהים על הביטוי הגולמי, לפני הנרמול, ומוחלפים במילים
 * המלאות — אחרת מי שחיפש רואה חשבון קיבל את תחום הרוחניות.
 */
const ACRONYMS = [
	{ mark: 'רו"ח', words: ['רואה', 'חשבון'] },
	{ mark: 'עו"ד', words: ['עורך', 'דין'] },
	{ mark: 'עו"ס', words: ['עובדת', 'סוציאלית'] }
];

/** פירוק טקסט למילים מנורמלות @param {string} s */
export const words = (s) =>
	norm(s)
		.split(/[^\p{L}\p{N}]+/u)
		.filter(Boolean);

/** אורך מקטע הפתיחה המשותף @param {string} a @param {string} b */
function sharedPrefix(a, b) {
	let i = 0;
	while (i < a.length && a[i] === b[i]) i++;
	return i;
}

/**
 * האם שתי מילים הן בפועל אותה מילה: זהות, אחת פתיחה של השנייה (גם אחרי
 * הסרת אות שימוש), או מקטע פתיחה משותף שמספיק ארוך — כי צורות הנטייה
 * בעברית נבדלות בסופן ("אינסטלטור" / "אינסטלציה" חולקות "אינסטל").
 * מילה קצרה מ-3 אותיות לא נבדקת כלל: היא נופלת כמעט על הכול.
 *
 * strict מוותר על השורש המשותף ומשאיר רק פתיחה מלאה. הוא נדרש בכל מקום
 * שבו הצד השני אינו המילה שהוקלדה אלא נרדפת שהוספנו לה: שתי הרחבות
 * מצטברות מייצרות שטויות — כך "ניקוי" נפל על "מניקור" (שורש "ניקו")
 * והחיפוש "מנקה" החזיר מכוני יופי.
 * @param {string} a @param {string} b @param {boolean} [strict]
 */
export function akin(a, b, strict = false) {
	if (!a || !b) return false;
	if (a === b) return true;
	const [short, long] = a.length <= b.length ? [a, b] : [b, a];
	if (short.length < 3) return false;
	const forms = PREFIX_LETTERS.includes(long[0]) ? [long, long.slice(1)] : [long];
	for (const form of forms) {
		if (form.startsWith(short)) return true;
		if (!strict && short.length >= STEM && sharedPrefix(short, form) >= STEM) return true;
	}
	return false;
}

/**
 * הטקסונומיה, מנורמלת פעם אחת בטעינת המודול.
 *   labelWords — מילות התווית, להתאמה מול מילת חיפוש ומול התחום שעל הכרטיסייה
 *   keyWords   — מילות המפתח מפורקות, להתאמה מול מילת חיפוש
 *   phrases    — מילות המפתח כמות שהן, לבדיקת includes מול טקסט הכרטיסייה
 *                (בדיוק כמו הסיווג האוטומטי ב-guessCategory)
 */
const DOMAINS = CATEGORY_DEFS.filter((c) => c.match?.length).map((c) => ({
	label: c.label,
	labelWords: words(c.label),
	keyWords: [...new Set((c.match ?? []).flatMap((m) => words(m)))],
	phrases: (c.match ?? []).map(norm).filter(Boolean)
}));

/**
 * @typedef {Object} Query הביטוי אחרי פירוק והרחבה
 * @property {string[]} words  המילים שהוקלדו בפועל
 * @property {string[]} syn    מילים נרדפות (מילה בודדת) — נבדקות בניקוד מופחת
 * @property {string[]} phrases נרדפות שהן צירוף — נבדקות כמחרוזת בתוך הטקסט
 */

/**
 * פירוק הביטוי + הרחבה בנרדפות. מילות רקע נזרקות, אלא אם לא נשאר בלעדיהן
 * כלום (חיפוש כמו "עסק טוב") — אז מוטב להשוות למה שיש.
 * @param {string} query
 * @returns {Query}
 */
function parseQuery(query) {
	const all = words(query).filter((w) => w.length >= 3);
	const meaningful = all.filter((w) => !STOP.has(w));
	let qw = meaningful.length ? meaningful : all;

	// ראשי תיבות: הצורה המשוטחת ("רוח") יוצאת, המילים המלאות נכנסות במקומה
	const marked = String(query ?? '').replace(/['׳״`]/g, '"');
	for (const a of ACRONYMS) {
		if (!marked.includes(a.mark)) continue;
		const flat = norm(a.mark);
		qw = [...qw.filter((w) => w !== flat), ...a.words.map(norm)];
	}
	const full = norm(qw.join(' '));

	/** @type {Set<string>} */
	const syn = new Set();
	/** @type {Set<string>} */
	const phrases = new Set();
	for (const group of SYNONYM_GROUPS) {
		const hit = group.some((entry) =>
			entry.includes(' ') ? full.includes(entry) : qw.some((q) => akin(q, entry))
		);
		if (!hit) continue;
		for (const entry of group) {
			if (entry.includes(' ')) phrases.add(entry);
			else if (!qw.some((q) => akin(q, entry))) syn.add(entry);
		}
	}
	return { words: qw, syn: [...syn], phrases: [...phrases] };
}

/**
 * התחומים הקרובים לביטוי החיפוש, מהחזק לחלש. שניים לכל היותר — מעבר לזה
 * כבר אי אפשר לקרוא לתוצאה "התחום שביקשת".
 * @param {Query} q
 */
function relatedDomains(q) {
	const hit = (/** @type {string[]} */ list, /** @type {string} */ w, /** @type {boolean} */ s) =>
		list.some((x) => akin(w, x, s));
	return DOMAINS.map((d) => {
		let score = 0;
		for (const w of q.words) {
			// מילת מפתח היא סימן חזק יותר מהתווית: התוויות רחבות ("בית", "מדיה")
			if (hit(d.keyWords, w, false)) score += 3;
			else if (hit(d.labelWords, w, false)) score += 2;
		}
		// נרדפת מעידה על התחום פחות מהמילה שהוקלדה, אבל היא בדיוק מה שמחבר
		// "שרברב" לתחום שבו יושבת האינסטלציה
		for (const w of q.syn) if (hit(d.keyWords, w, true) || hit(d.labelWords, w, true)) score += 1;
		for (const p of q.phrases)
			if (d.phrases.some((x) => x.includes(p) || p.includes(x))) score += 1;
		return { d, score };
	})
		.filter((h) => h.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, 2)
		.map((h) => h.d);
}

/** השדות שנבדקים בהתאמה ישירה, לפי כמה כל אחד מהם מעיד על המקצוע.
 *  התגיות כמעט בראש: הן המילים שבעל העסק בחר בעצמו כדי שימצאו אותו,
 *  ובלי משקל אמיתי הן היו קישוט. */
const FIELDS = [
	['name', 10],
	['tags', 9],
	['subcategory', 8],
	['category', 6],
	['discount', 4],
	['slogan', 3],
	['salesArea', 3],
	['description', 2]
];

/** ערך שדה כטקסט אחד — התגיות מגיעות כמערך. @param {unknown} v */
const fieldText = (v) => (Array.isArray(v) ? v.join(' ') : String(v ?? ''));

/**
 * ניקוד התאמה ישירה: מילה בשדה שחולקת שורש עם מילת החיפוש (או עם נרדפת
 * שלה, בחצי משקל — "שרברב" מגיע כך אל "אינסטלציה" שבשם העסק).
 * @param {any} b @param {Query} q
 */
function directScore(b, q) {
	let score = 0;
	for (const [field, weight] of FIELDS) {
		const raw = fieldText(b?.[field]);
		if (!raw) continue;
		const w = Number(weight);
		const fw = words(raw);
		const text = norm(raw);
		for (const term of q.words) if (fw.some((x) => akin(term, x))) score += w;
		for (const term of q.syn) if (fw.some((x) => akin(term, x, true))) score += Math.ceil(w / 2);
		for (const term of q.phrases) if (text.includes(term)) score += Math.ceil(w / 2);
	}
	return score;
}

/** ניקוד קרבת תחום @param {any} b @param {typeof DOMAINS} doms */
function domainScore(b, doms) {
	if (!doms.length) return 0;
	const head = norm(`${b?.name ?? ''} ${b?.subcategory ?? ''} ${fieldText(b?.tags)}`);
	const body = norm(`${b?.description ?? ''} ${b?.slogan ?? ''} ${b?.discount ?? ''}`);
	// כל התחומים של העסק — הראשי והנוספים (categories מדף הבית); נפילה
	// אחורה לשדה הבודד כשקוראים למנוע עם צורה ישנה
	const catWords = words(
		Array.isArray(b?.categories) ? b.categories.join(' ') : String(b?.category ?? '')
	);
	let score = 0;
	doms.forEach((d, i) => {
		// התחום השני קרוב פחות מהראשון, ולכן שוקל חצי
		const w = i === 0 ? 2 : 1;
		if (catWords.length && d.labelWords.some((lw) => catWords.some((cw) => akin(cw, lw))))
			score += 3 * w;
		if (d.phrases.some((p) => head.includes(p))) score += 2 * w;
		else if (d.phrases.some((p) => body.includes(p))) score += 1 * w;
	});
	return score;
}

/**
 * העסקים הקרובים ביותר לביטוי חיפוש שלא החזיר אף תוצאה.
 * מוחזרים רק עסקים שקיבלו ניקוד ממשי — הצעה מקרית גרועה מ"לא נמצא".
 * @param {string} query ביטוי החיפוש כפי שהוקלד
 * @param {any[]} pool הרשימה שממנה מציעים
 * @param {number} [limit] כמה כרטיסיות להציג
 * @returns {any[]}
 */
export function suggestForQuery(query, pool, limit = 6) {
	const q = parseQuery(query ?? '');
	if (!q.words.length || !Array.isArray(pool) || !pool.length) return [];
	const doms = relatedDomains(q);
	return pool
		.map((b) => ({ b, score: directScore(b, q) + domainScore(b, doms) }))
		.filter((s) => s.score > 0)
		.sort(
			(x, y) =>
				y.score - x.score ||
				Number(y.b?.rating ?? 0) - Number(x.b?.rating ?? 0) ||
				String(x.b?.name ?? '').localeCompare(String(y.b?.name ?? ''), 'he')
		)
		.slice(0, limit)
		.map((s) => s.b);
}
