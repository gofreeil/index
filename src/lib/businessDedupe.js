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
// לא מספיק — לבעל עסק אחד יכולים להיות כמה עסקים, ולכל אחד שם משלו.
//
// "אולי אותו עסק" = אותם פרטי קשר ושם שמרחיב את השני ("X" מול "X - תוספת").
// זה יכול להיות אותו עסק שהוגש שוב, או עסק נוסף של אותו אדם — ולכן טופס
// ההגשה שואל את המגיש, ולא ממזג על דעת עצמו.
//
// כמה גרסאות של אותו עסק מתאחדות ב-mergeBusinessVersions: הגרסה החדשה
// ביותר קובעת, וכל מה שחסר בה (תמונות, קישורים, שדות ריקים) נלקח מהקודמות.
//
// הקובץ client-safe (בלי ייבוא server-only) כדי שהפאנל יוכל לקבץ כפילויות
// באותה הגדרה בדיוק שבה השרת מונע אותן.
// ============================================================

import { canonicalPhoneKey } from '$lib/phoneIL.js';
import { MAX_BANNERS, parseMediaFit } from '$lib/mediaFit.js';

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

/** שם זהה אחרי נרמול. @param {unknown} x @param {unknown} y */
export function sameBizName(x, y) {
	const a = normalizeBizName(x);
	return Boolean(a) && a === normalizeBizName(y);
}

/**
 * השם הארוך מרחיב את הקצר במילים שלמות: "נעה שוהם - המרכז הישראלי
 * לאירועים" מרחיב את "נעה שוהם".
 * @param {unknown} long @param {unknown} short
 */
function extendsName(long, short) {
	const l = normalizeBizName(long);
	const s = normalizeBizName(short);
	return s.length >= 3 && l.startsWith(s + ' ');
}

/** @param {any} b */
function ownerEmailOf(b) {
	return String(b?.extra_fields?.owner_email ?? b?.email ?? '')
		.trim()
		.toLowerCase();
}

/** אותו טלפון או אותו אימייל של בעל העסק. @param {any} a @param {any} b */
function sameContact(a, b) {
	const pa = canonicalPhoneKey(a?.phone);
	if (pa && pa === canonicalPhoneKey(b?.phone)) return true;
	const ea = ownerEmailOf(a);
	return Boolean(ea) && ea === ownerEmailOf(b);
}

/**
 * @typedef {Object} BizIdentity
 * @property {string} name
 * @property {string} [phone]
 * @property {string} [email]  אימייל בעל העסק (extra_fields.owner_email)
 */

/**
 * האם שתי רשומות/הגשות הן אותו עסק: אותו שם ואותם פרטי קשר.
 * מקבל גם רשומת Strapi (עם extra_fields.owner_email) וגם ערכי טופס גולמיים.
 * @param {any} a @param {any} b
 */
export function isSameBusiness(a, b) {
	return sameBizName(a?.name, b?.name) && sameContact(a, b);
}

/**
 * "אולי אותו עסק": אותם פרטי קשר, ושם זהה או שם שמרחיב את השני. משמש רק
 * לשאלה שטופס ההגשה מציג למגיש — לא לקיבוץ ולא למיזוג אוטומטי.
 * @param {any} a @param {any} b
 */
export function isPossiblySameBusiness(a, b) {
	if (!sameContact(a, b)) return false;
	return (
		sameBizName(a?.name, b?.name) || extendsName(a?.name, b?.name) || extendsName(b?.name, a?.name)
	);
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

/** @param {any} r */
const stamp = (r) => new Date(r?.createdAt ?? 0).getTime() || 0;

/**
 * @typedef {Object} DupGroup
 * @property {number} size      כמה רשומות בקבוצה (1 = אין כפילות)
 * @property {string} keepId    ה-documentId של הגרסה החדשה ביותר — זו שנשארת ומקבלת את המיזוג
 * @property {string[]} others  ה-documentId של הגרסאות הקודמות — נמחקות אחרי המיזוג
 * @property {number} ordinal   מקום הרשומה בקבוצה לפי תאריך (1 = הראשונה)
 */

/**
 * קיבוץ רשימת עסקים לקבוצות "אותו עסק". התוצאה: לכל documentId — הקבוצה שלו.
 * הגרסה החדשה ביותר (createdAt) נשארת; הקודמות ממוזגות לתוכה.
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
		const sorted = [...g].sort((a, b) => stamp(a) - stamp(b));
		const keepId = String(sorted[sorted.length - 1]?.documentId ?? '');
		const others = sorted.slice(0, -1).map((x) => String(x.documentId));
		sorted.forEach((x, i) => {
			out.set(String(x.documentId), { size: sorted.length, keepId, others, ordinal: i + 1 });
		});
	}
	return out;
}

// ── מיזוג גרסאות ─────────────────────────────────────────────

/** @param {unknown} v */
function isEmpty(v) {
	if (v == null) return true;
	if (typeof v === 'string') return !v.trim();
	if (Array.isArray(v)) return v.length === 0;
	if (typeof v === 'object') return Object.keys(v).length === 0;
	return false;
}

/** @param {unknown} v */
const isPlainObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/** הערך הראשון שאינו ריק, מהחדש לישן. @param {unknown[]} values */
const firstFilled = (values) => values.find((v) => !isEmpty(v));

// עמודות שלא ממוזגות כטקסט: מזהים ותאריכים של Strapi, סטטוס (נקבע בידי מי
// שממזג), מונים (נסכמים), ומה שיש לו כלל משלו למטה.
const NOT_MERGED = new Set([
	'id',
	'documentId',
	'createdAt',
	'updatedAt',
	'publishedAt',
	'locale',
	'localizations',
	'status',
	'source',
	'external_id',
	'accepted_terms',
	'view_count',
	'phone_reveal_count',
	'rating_avg',
	'rating_count',
	'name',
	'logo',
	'banners',
	'user',
	'user_id',
	'extra_fields',
	'reviews'
]);
const COUNTERS = ['view_count', 'phone_reveal_count'];

/** @param {any} r @returns {string} */
const ownerIdOf = (r) => String(r?.user_id || r?.user?.id || '');

/**
 * מיזוג כמה גרסאות של אותו עסק לרשומה אחת — "הגרסה החדשה ביותר + מה שחסר
 * בה נלקח מהקודמות":
 *   • כל שדה: הערך של הגרסה החדשה ביותר שבה הוא לא ריק.
 *   • שם: של החדשה — אלא אם שם קודם מרחיב אותו ("X" מול "X - תוספת"); אז
 *     התוספת נשמרת, כי היא מידע שהחדשה פשוט לא כללה.
 *   • extra_fields: לפי מפתח, החדשה קובעת; אובייקט (קישורים) — לפי תת-מפתח.
 *   • לוגו: של החדשה ביותר שיש לה לוגו. תמונות: כולן, מהחדשה לישנה, בלי
 *     כפילויות, עד MAX_BANNERS — יחד עם המיקום/זום של כל תמונה.
 *   • בעלים: בעלות קיימת לא מוחלפת (הוותיקה קובעת).
 *   • מונים (צפיות, חשיפות טלפון): נסכמים.
 * הקבצים עצמם לא נמחקים לעולם — מחיקת רשומה ב-Strapi לא נוגעת בספריית המדיה.
 *
 * @param {any[]} versions  רשומות Strapi (עם logo/banners מאוכלסים) או
 *                          רשומה-מועמדת באותה צורה (logo: {id}, banners: [{id}])
 * @param {any} target      הרשומה שתקבל את המיזוג (אחת מ-versions)
 * @returns {Record<string, any>} רק השדות שצריך לשנות ב-target (ריק = אין מה לשנות)
 */
export function mergeBusinessVersions(versions, target) {
	const byNewest = [...versions].filter(Boolean).sort((a, b) => stamp(b) - stamp(a));
	if (!byNewest.length) return {};
	/** @type {Record<string, any>} */
	const merged = {};

	// ── עמודות רגילות ──
	const keys = new Set(byNewest.flatMap((r) => Object.keys(r)));
	for (const k of keys) {
		if (NOT_MERGED.has(k)) continue;
		const v = firstFilled(byNewest.map((r) => r[k]));
		if (v !== undefined) merged[k] = v;
	}

	// ── שם ──
	let name = String(firstFilled(byNewest.map((r) => r.name)) ?? '');
	for (const r of byNewest) {
		if (extendsName(r.name, name)) name = String(r.name);
	}
	if (name) merged.name = name;

	// ── מונים ──
	for (const k of COUNTERS) {
		merged[k] = byNewest.reduce((sum, r) => sum + (Number(r[k]) || 0), 0);
	}

	// ── בעלים ──
	const ownerSrc = [...byNewest].reverse().find((r) => ownerIdOf(r));
	if (ownerSrc) {
		const id = ownerIdOf(ownerSrc);
		merged.user_id = id;
		merged.user = Number.isFinite(Number(id)) ? Number(id) : id;
	}

	// ── לוגו ותמונות, כל אחד עם המיקום/זום שלו ──
	const logoSrc = byNewest.find((r) => r?.logo?.id);
	/** @type {number[]} */
	const bannerIds = [];
	/** @type {unknown[]} */
	const bannerFits = [];
	let main = 0;
	for (const r of byNewest) {
		const fit = r?.extra_fields?.media_fit ?? {};
		const list = Array.isArray(r?.banners) ? r.banners : [];
		// התמונה הראשית: של הגרסה החדשה ביותר שיש בה תמונות — והיא הראשונה
		// שנכנסת לרשימה, ולכן האינדקס שלה לא זז.
		if (!bannerIds.length && list.length) main = Number(fit.main) || 0;
		list.forEach((/** @type {any} */ b, /** @type {number} */ i) => {
			if (!b?.id || bannerIds.includes(b.id) || bannerIds.length >= MAX_BANNERS) return;
			bannerIds.push(b.id);
			bannerFits.push(Array.isArray(fit.banners) ? fit.banners[i] : undefined);
		});
	}
	if (main >= bannerIds.length) main = 0;
	const logoFit = logoSrc?.extra_fields?.media_fit ?? {};
	const mediaFit = parseMediaFit({
		logo: logoFit.logo,
		logo_shape: logoFit.logo_shape,
		banners: bannerFits,
		main
	});

	// ── extra_fields ──
	/** @type {Record<string, any>} */
	const extra = {};
	const extraKeys = new Set(
		byNewest.flatMap((r) => (isPlainObject(r?.extra_fields) ? Object.keys(r.extra_fields) : []))
	);
	for (const k of extraKeys) {
		if (k === 'media_fit') continue;
		const values = byNewest.map((r) => r?.extra_fields?.[k]);
		if (values.some(isPlainObject)) {
			/** @type {Record<string, any>} */
			const obj = {};
			for (const v of [...values].reverse()) {
				if (!isPlainObject(v)) continue;
				for (const [sk, sv] of Object.entries(v)) if (!isEmpty(sv)) obj[sk] = sv;
			}
			if (Object.keys(obj).length) extra[k] = obj;
			continue;
		}
		const v = firstFilled(values);
		if (v !== undefined) extra[k] = v;
	}
	if (mediaFit) extra.media_fit = mediaFit;
	merged.extra_fields = extra;

	// ── רק מה שבאמת שונה ב-target ──
	/** @type {Record<string, any>} */
	const patch = {};
	for (const [k, v] of Object.entries(merged)) {
		if (k === 'user') continue; // נכתב יחד עם user_id
		if (JSON.stringify(v) !== JSON.stringify(target?.[k] ?? (typeof v === 'number' ? 0 : null))) {
			patch[k] = v;
		}
	}
	if ('user_id' in patch) patch.user = merged.user;
	const targetLogo = target?.logo?.id ?? null;
	if ((logoSrc?.logo?.id ?? null) !== targetLogo && logoSrc) patch.logo = logoSrc.logo.id;
	const targetBanners = (Array.isArray(target?.banners) ? target.banners : []).map(
		(/** @type {any} */ b) => b?.id
	);
	if (JSON.stringify(bannerIds) !== JSON.stringify(targetBanners)) patch.banners = bannerIds;
	return patch;
}
