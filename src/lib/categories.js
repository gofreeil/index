// ============================================================
// טקסונומיית התחומים של האינדקס — נקודת האמת היחידה.
//
// עד כאן הרשימה הייתה מערך מחרוזות בלבד, וכל הסיווג נשען על השדה `category`
// שהמגיש בחר. בפועל 73 מתוך 92 הכרטיסיות הוזרמו בייבוא בלי קטגוריה כלל,
// ועוד 7 נשמרו כ"אחר" — כלומר 80 מתוך 92 נדחסו לערימה אחת בשם "אחר",
// והסינון באתר היה חסר משמעות.
//
// לכן לכל תחום יש כאן שלושה דברים:
//   label   — הערך שנשמר ב-Strapi ומוצג לגולש (לא מפתח באנגלית: המאגר כבר
//             מלא בתוויות עבריות, ומיגרציה של הערכים הייתה שוברת רשומות).
//   icon    — אימוג'י לאריח התחום במסילה שבדף הבית.
//   match   — מילות מפתח לסיווג אוטומטי של כרטיסייה שאין לה קטגוריה (או
//             שנשמרה כ"אחר"), לפי השם + תת-התחום + התיאור.
//
// סדר המערך הוא גם סדר עדיפות ההתאמה (הראשון שנפגע — מנצח), ולכן תחום
// ספציפי חייב להופיע לפני תחום כללי שעלול לבלוע אותו: "פדיקור רפואי" הוא
// יופי וטיפוח ולא רפואה, "מכללת קריירה" היא לימודים ולא פיננסים.
//
// הכלל שנשאר בתוקף: תחום נוסף רק כשיש לו לפחות 3 עסקים אמיתיים — מסנן
// כמעט-ריק פוגע גם בגולש וגם בסיכוי של הדף להיתפס בגוגל. תחומים שנשמרו
// בלי עסקים (עורכי דין, בייביסיטר, חוגים ופנאי) קיימים בטופס ההגשה בלבד;
// מסילת התחומים בדף הבית מציגה רק תחומים שיש בהם עסקים בפועל.
// ============================================================

/** התווית של "כל השאר" — תמיד אחרונה, וגם ברירת המחדל כשאין התאמה */
export const OTHER = 'אחר';

/**
 * @typedef {Object} CategoryDef
 * @property {string} label התווית הקנונית — הערך שנשמר במאגר ומוצג לגולש
 * @property {string} icon אימוג'י לאריח התחום
 * @property {string[]} [aliases] תוויות ישנות שנשמרו במאגר וממופות לתווית הזו
 * @property {string[]} [match] מילות מפתח לסיווג אוטומטי (שם + תת-תחום + תיאור)
 */

/** @type {CategoryDef[]} */
export const CATEGORY_DEFS = [
	{
		label: 'בית, שיפוצים ותחזוקה',
		icon: '🛠️',
		aliases: ['בית ותחזוקה'],
		match: [
			'שיפוצ',
			'אינסטלצ',
			'נגר',
			'גבס',
			'הנדימן',
			'תריס',
			'סנפלינג',
			'הרחקת יונים',
			'גיזום',
			'כריתת עצים',
			'רעפים',
			'צימרים',
			'בניין',
			'בנייה',
			'ריצוף',
			'איטום',
			'רהיטים',
			'מטבחים',
			'ארונות',
			'חיפוי',
			'צביעת',
			'עבודות צבע',
			'הכל לבית'
		]
	},
	{
		label: 'חשמל, מיזוג ומוצרי חשמל',
		icon: '❄️',
		match: [
			'מזגן',
			'מיזוג אוויר',
			'מיזוג אויר',
			'חשמלאי',
			'מוצרי חשמל',
			'מקרר',
			'מכונת כביסה',
			'מכונות כביסה',
			'מדיח',
			'מקפיא',
			'מייבש'
		]
	},
	{
		label: 'נדל"ן ומשכנתאות',
		icon: '🏠',
		match: ['משכנת', 'נדלן', 'תיווך', 'תיוך', 'דירה מקבלן', 'רכישת דירה', 'ליווי משקיעים', 'נכסים']
	},
	{
		// לפני "לימודים": מטפל רוחני שמעביר גם קורסים הוא קודם כול רוחניות,
		// והמילה "קורס" בסוף תיאור ארוך לא אמורה לגבור על "מורה רוחנית" שבשם
		label: 'רוחניות ויהדות',
		icon: '🕯️',
		match: [
			'רוחני',
			'קבלי',
			'מקובל',
			'גאולה',
			'שמות הקודש',
			'תפילה',
			'יהדות',
			'תורה',
			'הלכה',
			'ברכות'
		]
	},
	{
		label: 'לימודים, קורסים והכשרה',
		icon: '🎓',
		aliases: ['לימודים והכשרה'],
		match: ['קורס', 'מכלל', 'שיעור', 'הכשרה', 'לימודי', 'ללמוד', 'בית ספר', 'תעודת הוראה']
	},
	{
		label: 'שירותים פיננסיים',
		icon: '💰',
		aliases: ['שירותים פיננסים'],
		match: [
			'חשבונאות',
			'הנהלת חשבונות',
			'פיננס',
			'הלוואה',
			'הלוואות',
			'כלכלי',
			'ההון האישי',
			'ביטוח',
			'מס הכנסה',
			'החזרי מס'
		]
	},
	{
		label: 'ייעוץ עסקי, שיווק ומכירות',
		icon: '📈',
		aliases: ['ייעוץ עסקי ושיווק'],
		match: [
			// "עסקי" לבדה נבלעת ב"פתרונות ... לעסקים" של יצרנים — רק צירופים
			'ייעוץ עסקי',
			'יעוץ עסקי',
			'ליווי עסקי',
			'אימון עסקי',
			'מכירות',
			'שיווק',
			'פרסום',
			'קמפיין',
			'סושיאל',
			'מיתוג',
			'דפי נחיתה',
			'מדיה',
			'קידום'
		]
	},
	{
		label: 'מחשבים וטכנולוגיה',
		icon: '💻',
		match: [
			'מחשב',
			'סלולר',
			'תוכנה',
			'בניית אתרים',
			'סייבר',
			'תחנות עבודה',
			'אינטרנט',
			'שרת',
			'אפליקצ'
		]
	},
	{
		label: 'יופי וטיפוח',
		icon: '💅',
		match: [
			'קוסמטי',
			'ציפורניים',
			'מניקור',
			'פדיקור',
			'מכון יופי',
			'איפור',
			'מספרה',
			'תספורת',
			'הסרת שיער',
			'טיפולי פנים',
			'גבות'
		]
	},
	{
		label: 'רפואה משלימה ואנרגטית',
		icon: '🌿',
		aliases: ['רפואה משלימה'],
		match: [
			'רפלקסולוג',
			'נטורופת',
			'הומאופת',
			'אוסטאופת',
			'קינסיולוג',
			'הילינג',
			'ביואנרגיה',
			'אנרגי',
			'תדר',
			'צמחי מרפא',
			'כוסות רוח',
			'עיסוי',
			'שיאצו',
			'אקסס בארס',
			'הוליסטי',
			'רפואה אלטרנטיבית',
			'רפואה טבעית',
			'בריאות טבעית',
			'דיקור',
			'חדר מלח',
			'מכשיר מלח',
			'מכשירי מלח',
			'גוף ונפש',
			'שחרור מפרקים'
		]
	},
	{
		label: 'הריון, לידה והורות',
		icon: '🤱',
		match: ['לידה', 'דולה', 'הריון', 'הנקה', 'יועצת שינה', 'הדרכת הורים', 'הורות', 'גיל הרך']
	},
	{
		label: 'טיפול רגשי ואימון אישי',
		icon: '🧠',
		aliases: ['טיפול וייעוץ'],
		match: [
			'פסיכותרפ',
			'פסיכולוג',
			'cbt',
			'ייעוץ זוגי',
			'זוגי',
			'זוגיות',
			'אימון אישי',
			'אימון תודעתי',
			'מאמנת אישית',
			'מאמן אישי',
			'תודעת',
			'תודעה',
			'רגשי',
			'חרדות',
			'טראומ',
			'קשב',
			'ריכוז',
			'גישור',
			'נשיות',
			'סדנאות',
			'עובדת סוציאלית'
		]
	},
	{
		label: 'בריאות ותזונה',
		icon: '🥗',
		match: ['תזונ', 'דיאט', 'תוספי', 'כושר', 'אימוני כוח', 'ירידה במשקל', 'בריאות']
	},
	{
		label: 'אוכל ומזון',
		icon: '🍽️',
		// "מאפ" לבדה נבלעת ב"המאפשר" — רק המילה המלאה
		match: ['קייטרינג', 'מאפה', 'מאפי', 'עוגות', 'גבינות', 'טבעוני', 'מסעד', 'בישול', 'קונדיטור']
	},
	{
		label: 'אירועים והופעות',
		icon: '🎉',
		aliases: ['אירועים'],
		match: [
			'אירוע',
			'הופע',
			'dj',
			'תקליטן',
			'זמר',
			'פייטן',
			'נגן',
			'להקה',
			'פנטומימ',
			'צילום',
			'הגברה',
			'אמן חושים',
			'חתונה'
		]
	},
	{
		label: 'עיצוב, אומנות ויצירה',
		icon: '🎨',
		match: ['עיצוב', 'אומנות', 'אמנות', 'ציור', 'גלריה', 'יצירה', 'צורפות', 'art']
	},
	{
		label: 'הובלות והסעות',
		icon: '🚚',
		aliases: ['הובלות'],
		match: ['הובל', 'הסע', 'מוביל', 'משאית', 'שינוע', 'מונית']
	},
	{
		label: 'תעשייה, ייצור ומקצועות',
		icon: '🏭',
		match: ['נירוסטה', 'חריטה', 'פרזול', 'ריתוך', 'מסגרות', 'ייצור', 'אלומיניום', 'אלומניום']
	},
	{
		label: 'עורכי דין ומשפט',
		icon: '⚖️',
		aliases: ['עורכי דין'],
		// בלי עו"ד: הנרמול מוריד את הגרשיים והיא נבלעת במילה "עוד"
		match: ['עורך דין', 'עורכת דין', 'משפט', 'תביע', 'נוטריון']
	},
	{ label: 'חוגים ופנאי', icon: '🎯', match: ['חוגים', 'ספורט', 'טיולים', 'פנאי'] },
	{
		label: 'בייביסיטר וטיפול בילדים',
		icon: '🧸',
		aliases: ['בייביסיטר'],
		match: ['בייביסיטר', 'שמרטף', 'מטפלת לילדים']
	},
	{ label: OTHER, icon: '📦' }
];

/** רשימת התוויות — לטופס ההגשה ולתפריטי הבחירה */
export const CATEGORIES = CATEGORY_DEFS.map((c) => c.label);

/** תווית → הגדרה. @type {Map<string, CategoryDef>} */
const BY_LABEL = new Map(CATEGORY_DEFS.map((c) => [c.label, c]));

/** האימוג'י של תחום (📦 לתחום שאינו ברשימה). @param {string} label */
export const categoryIcon = (label) => BY_LABEL.get(label)?.icon ?? '📦';

/** אותיות סופיות → הצורה הרגילה. @type {Record<string, string>} */
const FINALS = { ם: 'מ', ן: 'נ', ץ: 'צ', ף: 'פ', ך: 'כ' };

/**
 * נרמול טקסט להשוואה: אותיות קטנות, בלי גרשיים/מקפים (נדל"ן = נדלן = נדל-ן),
 * אותיות סופיות מקופלות ורווחים מכווצים. בלי קיפול הסופיות "מזגן" אינה
 * תת-מחרוזת של "המזגנים" — ן ו-נ הם תווים שונים — וכל צורת רבים הייתה
 * דורשת מילת מפתח משלה.
 * @param {string} s
 */
const norm = (s) =>
	String(s ?? '')
		.toLowerCase()
		.replace(/["'׳״`־–—-]/g, '')
		.replace(/[םןץףך]/g, (c) => FINALS[c])
		.replace(/\s+/g, ' ')
		.trim();

/** תווית מנורמלת → תווית קנונית (כולל התוויות הישנות שבמאגר). @type {Map<string, string>} */
const BY_ALIAS = new Map();
for (const def of CATEGORY_DEFS) {
	BY_ALIAS.set(norm(def.label), def.label);
	for (const a of def.aliases ?? []) BY_ALIAS.set(norm(a), def.label);
}

/** מילות מפתח מנורמלות מראש — הסיווג רץ על 92 כרטיסיות בכל טעינת דף בית */
const MATCHERS = CATEGORY_DEFS.filter((c) => c.match?.length).map((c) => ({
	label: c.label,
	words: (c.match ?? []).map(norm)
}));

/**
 * ניחוש תחום מתוך הטקסט של הכרטיסייה. מחזיר '' כשאין התאמה בטוחה —
 * ניחוש שגוי גרוע מ"אחר", כי הוא שולח את הגולש לתחום הלא נכון.
 *
 * השדות נבדקים בשכבות ולא כמחרוזת אחת מאוחדת, כי הם אינם שווי-ערך: השם
 * ותת-התחום הם מה שהעסק קורא לעצמו, התיאור מסביר, ו"מה מייחד אתכם" הוא
 * טקסט שיווקי שמזכיר בדרך אגב עוד עשרה תחומים. בלי ההפרדה מטפלת הוליסטית
 * שכתבה שם "עיצוב חוויית לקוח" נחתה תחת "עיצוב ואומנות". רק אם שכבה שלמה
 * לא הניבה התאמה עוברים לשכבה הבאה.
 * @param {{name?: string, subcategory?: string, description?: string, unique_content?: string}} b
 * @returns {string}
 */
export function guessCategory(b) {
	const layers = [
		`${b?.name ?? ''} ${b?.subcategory ?? ''}`,
		String(b?.description ?? ''),
		String(b?.unique_content ?? '')
	];
	for (const layer of layers) {
		const text = norm(layer);
		if (!text) continue;
		for (const m of MATCHERS) {
			if (m.words.some((w) => w && text.includes(w))) return m.label;
		}
	}
	return '';
}

/**
 * התחום הסופי של כרטיסייה: מה שנבחר בהגשה גובר תמיד; ערך ריק או "אחר"
 * נשלח לסיווג האוטומטי; תווית חופשית שאינה ברשימה נשמרת כמו שהיא (לא
 * מוחקים בחירה של אדמין).
 * @param {{category?: string, name?: string, subcategory?: string, description?: string, unique_content?: string}} b
 * @returns {string}
 */
export function resolveCategory(b) {
	const raw = String(b?.category ?? '').trim();
	if (raw) {
		const canonical = BY_ALIAS.get(norm(raw));
		if (canonical && canonical !== OTHER) return canonical;
		if (!canonical) return raw;
	}
	return guessCategory(b) || OTHER;
}

/** נרמול תווית להשוואה — חשוף למסך ניהול הקטגוריות (ספירה והתאמת כפילויות) */
export const normCategoryLabel = norm;

// ============================================================
// דריסות תצוגה של סופר-אדמין (נשמרות ב-configStore בשרת).
//
// הרשימה שבקוד נשארת מקור האמת לסיווג ולערכים שנשמרים במאגר — הדריסות
// חלות על התצוגה בלבד: שם אחר, אימוג'י אחר, תמונה במקום אימוג'י, וסדר
// מפורש למסילת דף הבית. בנוסף אפשר להוסיף מהמסך קטגוריות חדשות (extras)
// שאינן בקוד — הן זמינות בטופס ההגשה ונשמרות במאגר לפי שמן.
//
// המפתחות יציבים: לקטגוריה מובנית — התווית הקנונית (גם אחרי שינוי שם);
// לקטגוריה שנוספה מהמסך — מזהה x_... שנוצר פעם אחת. כך שינוי שם לא שובר
// את הסדר השמור ולא את הרשומות במאגר (שם ישן של extra נשמר כ-alias).
//
// הפונקציות כאן טהורות (מקבלות settings כארגומנט) כדי שיעבדו גם בדפדפן —
// אסור לייבא לכאן מודולי $lib/server.
// ============================================================

/**
 * @typedef {Object} CategoryOverride
 * @property {string} [name]  שם תצוגה שדורס את התווית
 * @property {string} [icon]  אימוג'י שדורס את ברירת המחדל
 * @property {string} [image] כתובת תמונה שמחליפה את האימוג'י באריח
 *
 * @typedef {Object} CategoryExtra
 * @property {string} key       מזהה יציב (x_...)
 * @property {string} name      השם הנוכחי — זה גם הערך שנשמר במאגר
 * @property {string} [icon]
 * @property {string} [image]
 * @property {string[]} [aliases] שמות קודמים — רשומות ישנות ממופות לשם הנוכחי
 *
 * @typedef {Object} CategorySettings
 * @property {string[]} order מפתחות בסדר התצוגה הרצוי; ריק = סדר אוטומטי לפי כמות
 * @property {Record<string, CategoryOverride>} overrides לפי תווית קנונית
 * @property {CategoryExtra[]} extras
 *
 * @typedef {Object} EffectiveCategory
 * @property {string} key
 * @property {string} name
 * @property {string} icon
 * @property {string} image
 * @property {boolean} builtin
 * @property {string} [defaultName] לקטגוריה מובנית — התווית שבקוד
 * @property {string} [defaultIcon] לקטגוריה מובנית — האימוג'י שבקוד
 * @property {string[]} [aliases]   לקטגוריה שנוספה מהמסך
 */

/**
 * הרשימה האפקטיבית — הקטגוריות המובנות עם הדריסות + התוספות, בסדר שנקבע.
 * "אחר" מוצמדת תמיד לסוף, בדיוק כמו במסילת דף הבית.
 * @param {Partial<CategorySettings> | null | undefined} settings
 * @returns {EffectiveCategory[]}
 */
export function effectiveCategories(settings) {
	const overrides = settings?.overrides ?? {};
	const extras = Array.isArray(settings?.extras) ? settings.extras : [];

	/** @type {EffectiveCategory[]} */
	const list = CATEGORY_DEFS.map((def) => {
		const o = overrides[def.label] ?? {};
		return {
			key: def.label,
			name: String(o.name || def.label),
			icon: String(o.icon || def.icon),
			image: String(o.image || ''),
			builtin: true,
			defaultName: def.label,
			defaultIcon: def.icon
		};
	});
	for (const x of extras) {
		if (!x?.key || !x?.name) continue;
		list.push({
			key: String(x.key),
			name: String(x.name),
			icon: String(x.icon || '🏷️'),
			image: String(x.image || ''),
			builtin: false,
			aliases: Array.isArray(x.aliases) ? x.aliases.map(String) : []
		});
	}

	const order = Array.isArray(settings?.order) ? settings.order : [];
	const pos = new Map(order.map((k, i) => [String(k), i]));
	const natural = new Map(list.map((c, i) => [c.key, i]));
	list.sort((a, b) => {
		const lastA = a.key === OTHER ? 1 : 0;
		const lastB = b.key === OTHER ? 1 : 0;
		if (lastA !== lastB) return lastA - lastB;
		const pa = pos.has(a.key) ? /** @type {number} */ (pos.get(a.key)) : Infinity;
		const pb = pos.has(b.key) ? /** @type {number} */ (pos.get(b.key)) : Infinity;
		if (pa !== pb) return pa - pb;
		return (natural.get(a.key) ?? 0) - (natural.get(b.key) ?? 0);
	});
	return list;
}

/**
 * ממיר תווית קנונית (או חופשית) לשם התצוגה שלה: דריסת שם של קטגוריה
 * מובנית, או השם הנוכחי של extra (כולל שמות קודמים). תווית לא מוכרת
 * חוזרת כמו שהיא.
 * @param {Partial<CategorySettings> | null | undefined} settings
 * @returns {(label: string) => string}
 */
export function categoryDisplayResolver(settings) {
	/** @type {Map<string, string>} */
	const byNorm = new Map();
	for (const c of effectiveCategories(settings)) {
		if (c.builtin) {
			byNorm.set(norm(c.key), c.name);
		} else {
			byNorm.set(norm(c.name), c.name);
			for (const a of c.aliases ?? []) byNorm.set(norm(a), c.name);
		}
	}
	return (label) => byNorm.get(norm(label)) ?? label;
}

/**
 * המידע שמסילת דף הבית צריכה, ממופתח לפי שם תצוגה (כי זה מה שיושב על
 * הכרטיסיות אחרי ההמרה): אייקון/תמונה לכל תחום, הסדר המפורש (ריק אם
 * הסופר-אדמין לא קבע סדר — ואז נשאר המיון לפי כמות), והשם הנוכחי של
 * "אחר" כדי שיישאר מוצמד לסוף גם אם שונה שמו.
 * @param {Partial<CategorySettings> | null | undefined} settings
 */
export function categoryRailMeta(settings) {
	const list = effectiveCategories(settings);
	/** @type {Record<string, { icon: string, image: string }>} */
	const byName = {};
	for (const c of list) byName[c.name] = { icon: c.icon, image: c.image };
	const hasOrder = Array.isArray(settings?.order) && settings.order.length > 0;
	return {
		byName,
		order: hasOrder ? list.map((c) => c.name) : /** @type {string[]} */ ([]),
		otherName: list.find((c) => c.key === OTHER)?.name ?? OTHER
	};
}
