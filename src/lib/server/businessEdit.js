// ============================================================
// businessEdit.js — קריאת טופס עריכת כרטיסייה ואימותו
//
// מקור-אמת יחיד לשני מסכי העריכה:
//   /business/[id]/edit    בעל העסק (וגם אדמין) — עורך את התוכן
//   /admin/business/[id]   פאנל הניהול — אותם שדות + סטטוס, קואורדינטות ומחיקה
// השדות עצמם מוצגים ברכיב משותף ($lib/components/BusinessFormFields.svelte),
// כך שתוספת שדה נעשית בשני קבצים בלבד ולא בארבעה.
//
// canModerate מפריד בין השניים: הסטטוס הוא כלי ניהול, ובעל עסק לא משנה
// אותו (ובוודאי לא מאשר את עצמו). מה שנשלח בלעדיו — נדחה בשקט בשרת, גם
// אם מישהו יזייף את הטופס.
//
// אימייל הבעלים נשמר ב-extra_fields.owner_email ולא בעמודה משלו —
// לאוסף idx-business אין עמודת email, ו-Strapi מתעלם בשקט ממפתח לא מוכר
// (כך אבד עד היום האימייל שהוקלד בטופס ההגשה). הוא גם מפתח ההתאמה
// השני של מנוע הבעלות (ראו ownerMatch.js).
// ============================================================

import { uploadImage } from './strapi.js';
import { parseBranches } from '../branches.js';
import { parseExtraCategories } from '../categories.js';
import { parseTags } from '../tags.js';
import { parseMediaFit, MAX_BANNERS } from '../mediaFit.js';
import { EXTRA_LINK_KEYS } from '../socialLinks.js';

export const STATUSES = ['pending', 'approved', 'rejected', 'frozen'];

const URL_RE = /^https?:\/\/.+/i;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX_IMAGE_BYTES = 3_000_000;

/** שדות טקסט חופשי — נשמרים כמו שהוקלדו.
 * description אינו ברשימה: אין לו יותר שדה בטופס (הסלוגן ו"תיאור מורחב"
 * תפסו את מקומו), ושדה שאינו נשלח היה נקרא כמחרוזת ריקה ומוחק בשמירה את
 * הטקסט שכבר יושב בעמודה. כך הוא נשאר כמו שהוא. */
const TEXT_FIELDS = [
	'name',
	'category',
	'subcategory',
	'unique_content',
	'contact_name',
	'phone',
	'address',
	'city',
	'neighborhood',
	'sales_area',
	'discount'
];

/** שדות קישור — נשמרים עם https:// גם אם הודבקו בלעדיו. */
const LINK_FIELDS = ['website', 'whatsapp', 'facebook', 'instagram', 'youtube'];

/** @param {FormDataEntryValue|null} v */
const str = (v) => (typeof v === 'string' ? v.trim() : '');

/** @param {string} v */
const normUrl = (v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v);

/**
 * ממזג ערכים ל-extra_fields הקיים. Strapi מחליף עמודת json במלואה, ולכן
 * כתיבה בלי מיזוג הייתה מוחקת מפתחות אחרים שיושבים שם.
 * @param {any} current רשומת העסק הקיימת
 * @param {Record<string, unknown>} patch
 */
function mergeExtra(current, patch) {
	const base =
		current?.extra_fields && typeof current.extra_fields === 'object' ? current.extra_fields : {};
	return { ...base, ...patch };
}

/**
 * מזהי התמונות השמורות של הכרטיסייה, לפי סדרן.
 * @param {any} current @returns {number[]}
 */
function currentBannerIds(current) {
	return (Array.isArray(current?.banners) ? current.banners : [])
		.map((/** @type {any} */ b) => Number(b?.id))
		.filter((/** @type {number} */ id) => Number.isFinite(id));
}

/**
 * אותה רשימה בלי התמונות שסומנו להסרה בטופס — הסדר נשמר, ולכן גם
 * ה-media_fit שנוסע לפי אינדקס ממשיך להתאים.
 * @param {any} current @param {FormDataEntryValue[]} removed
 */
function keepBannerIds(current, removed) {
	const drop = new Set(removed.map(Number).filter(Number.isFinite));
	return currentBannerIds(current).filter((id) => !drop.has(id));
}

/**
 * קורא את טופס העריכה, מאמת אותו ומעלה מדיה חדשה.
 * @param {FormData} fd
 * @param {{canModerate: boolean, current?: any}} opts
 * @returns {Promise<{values: Record<string, any>, errors: Record<string, string>}>}
 */
export async function parseBusinessForm(fd, { canModerate, current }) {
	/** @type {Record<string, any>} */
	const values = {};
	/** @type {Record<string, string>} */
	const errors = {};

	for (const k of TEXT_FIELDS) values[k] = str(fd.get(k));
	for (const k of LINK_FIELDS) {
		values[k] = normUrl(str(fd.get(k)));
		if (values[k] && !URL_RE.test(values[k])) errors[k] = 'קישור לא תקין';
	}

	if (!values.name) errors.name = 'שם העסק חובה';

	// אימייל בעל העסק — ב-extra_fields (ראו כותרת הקובץ). ריק מוחק.
	const email = str(fd.get('email')).toLowerCase();
	if (email && !EMAIL_RE.test(email)) errors.email = 'אימייל לא תקין';
	/** @type {Record<string, unknown>} */
	const extraPatch = { owner_email: email };
	// סניפים ומקומות שירות נוספים — באותה עמודה. רק טופס ששלח את השדה נוגע
	// בהם: טופס ישן שאינו מכיר אותו לא ימחק רשימה קיימת.
	if (fd.has('branches')) extraPatch.branches = parseBranches(fd.get('branches'));

	// לסלוגן אין עמודה באוסף (Strapi היה מתעלם ממנו בשקט), ולכן הוא נשמר
	// באותו json. שדה שנשלח ריק מוחק את מה שהיה.
	if (fd.has('slogan')) extraPatch.slogan = str(fd.get('slogan'));

	// תגיות — באותה עמודה (ראו tags.js). כמו הסניפים: רק טופס ששלח את השדה
	// נוגע בהן, כדי שטופס ישן שאינו מכיר אותן לא ימחק רשימה קיימת.
	if (fd.has('tags')) extraPatch.tags = parseTags(fd.get('tags'));

	// קטגוריות נוספות — באותה עמודה (ראו ExtraCategoriesField.svelte). אותו
	// דין: רק טופס ששלח את השדה נוגע בהן. הראשית לא נשמרת פעמיים — היא
	// כבר יושבת בעמודת category.
	if (fd.has('extra_categories')) {
		extraPatch.categories = parseExtraCategories(fd.get('extra_categories')).filter(
			(c) => c !== values.category
		);
	}

	// מיקום וזום של הלוגו והתמונות. גם כאן רק טופס ששלח את השדה נוגע בהם,
	// ומיקום שחזר לברירת המחדל מוחק את המפתח במקום לשמור אותו סתם.
	// null ולא undefined: מפתח עם undefined נעלם ב-JSON.stringify, והערך הישן
	// היה שורד את השמירה — כלומר "מרכז" לא היה מוחק מיקום קודם.
	if (fd.has('media_fit')) extraPatch.media_fit = parseMediaFit(fd.get('media_fit'));

	// טיקטוק, X, לינקדאין ו"נוסף" — לרשתות האלה אין עמודה, ולכן הן נשמרות
	// באותו json (ראו socialLinks.js). גם כאן רק טופס ששלח את השדות נוגע
	// בהם; שדה שנשלח ריק מוחק את הקישור.
	if (EXTRA_LINK_KEYS.some((k) => fd.has(k))) {
		/** @type {Record<string, string>} */
		const links = {};
		for (const k of EXTRA_LINK_KEYS) {
			const v = normUrl(str(fd.get(k)));
			if (!v) continue;
			if (!URL_RE.test(v)) errors[k] = 'קישור לא תקין';
			links[k] = v;
		}
		extraPatch.links = links;
	}
	values.extra_fields = mergeExtra(current, extraPatch);

	// ── שדות ניהול: סטטוס ──
	// קואורדינטות אינן נערכות כאן. הן לא נקראות מהטופס וגם לא נכתבות, ולכן
	// שמירה מהמסך משאירה את הנקודה שעל המפה כמו שהיא.
	if (canModerate) {
		values.status = str(fd.get('status'));
		if (!STATUSES.includes(values.status)) errors.status = 'סטטוס לא תקין';
	}

	if (Object.keys(errors).length) return { values, errors };

	// ── הלוגו: יחיד, ולכן העלאה חדשה מחליפה וסימון תיבה מסיר ──
	const logoFile = fd.get('logo');
	if (logoFile && typeof logoFile !== 'string' && logoFile.size > 0) {
		if (!logoFile.type.startsWith('image/') || logoFile.size > MAX_IMAGE_BYTES) {
			errors.logo = 'קובץ לוגו חייב להיות תמונה עד 3MB';
			return { values, errors };
		}
		const id = await uploadImage(logoFile).catch(() => null);
		if (id) values.logo = id;
		else errors.logo = 'העלאת הלוגו נכשלה, נסו שוב';
	} else if (fd.get('remove_logo') === 'on') {
		values.logo = null;
	}
	if (errors.logo) return { values, errors };

	// ── תמונות העסק: העלאה חדשה *מתווספת* לקיימות ──
	// עד היום היא החליפה את כולן, וכל תוספת של תמונה אחת מחקה בשקט את מה
	// שכבר היה. הסרה נעשית עכשיו במפורש בלבד — כפתור ההסרה שליד כל תמונה
	// שולח את מזהה שלה (remove_banner_ids). remove_banners נשאר כמחיקה
	// גורפת, לטופס שמבקש אותה.
	const keptIds =
		fd.get('remove_banners') === 'on' ? [] : keepBannerIds(current, fd.getAll('remove_banner_ids'));
	const removedAny = keptIds.length !== currentBannerIds(current).length;

	const bannerFiles = /** @type {File[]} */ (
		fd.getAll('banners').filter((f) => f && typeof f !== 'string' && f.size > 0)
	);
	if (keptIds.length + bannerFiles.length > MAX_BANNERS) {
		errors.banners = `אפשר לשמור עד ${MAX_BANNERS} תמונות — הסירו תמונה קיימת כדי להוסיף`;
		return { values, errors };
	}
	if (bannerFiles.length) {
		/** @type {number[]} */
		const ids = [];
		for (const f of bannerFiles) {
			if (!f.type.startsWith('image/') || f.size > MAX_IMAGE_BYTES) {
				errors.banners = 'כל תמונה חייבת להיות קובץ תמונה עד 3MB';
				return { values, errors };
			}
			const id = await uploadImage(f).catch(() => null);
			if (id) ids.push(id);
		}
		// כשכל ההעלאות נכשלו אין מה לכתוב, ובעל העסק צריך לדעת שלא נשמרו
		if (!ids.length) {
			errors.banners = 'העלאת התמונות נכשלה, נסו שוב';
			return { values, errors };
		}
		values.banners = [...keptIds, ...ids];
	} else if (removedAny) {
		values.banners = keptIds;
	}

	return { values, errors };
}
