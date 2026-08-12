// ============================================================
// businessEdit.js — קריאת טופס עריכת כרטיסייה ואימותו
//
// מקור-אמת יחיד לשני מסכי העריכה:
//   /business/[id]/edit    בעל העסק (וגם אדמין) — עורך את התוכן
//   /admin/business/[id]   פאנל הניהול — אותם שדות + סטטוס, קואורדינטות ומחיקה
// השדות עצמם מוצגים ברכיב משותף ($lib/components/BusinessFormFields.svelte),
// כך שתוספת שדה נעשית בשני קבצים בלבד ולא בארבעה.
//
// canModerate מפריד בין השניים: סטטוס וקואורדינטות הם כלי ניהול, ובעל
// עסק לא משנה אותם (ובוודאי לא מאשר את עצמו). מה שנשלח בלעדיו — נדחה
// בשקט בשרת, גם אם מישהו יזייף את הטופס.
//
// אימייל הבעלים נשמר ב-extra_fields.owner_email ולא בעמודה משלו —
// לאוסף idx-business אין עמודת email, ו-Strapi מתעלם בשקט ממפתח לא מוכר
// (כך אבד עד היום האימייל שהוקלד בטופס ההגשה). הוא גם מפתח ההתאמה
// השני של מנוע הבעלות (ראו ownerMatch.js).
// ============================================================

import { uploadImage } from './strapi.js';
import { parseBranches } from '../branches.js';
import { EXTRA_LINK_KEYS } from '../socialLinks.js';

export const STATUSES = ['pending', 'approved', 'rejected', 'frozen'];

const URL_RE = /^https?:\/\/.+/i;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX_IMAGE_BYTES = 3_000_000;
const MAX_BANNERS = 4;

/** שדות טקסט חופשי — נשמרים כמו שהוקלדו. */
const TEXT_FIELDS = [
	'name',
	'category',
	'subcategory',
	'description',
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

	// ── שדות ניהול: סטטוס וקואורדינטות ──
	if (canModerate) {
		values.status = str(fd.get('status'));
		if (!STATUSES.includes(values.status)) errors.status = 'סטטוס לא תקין';

		// ריק מוחק את הנקודה מהמפה, מספר מעדכן אותה
		for (const k of ['lat', 'lng']) {
			const raw = str(fd.get(k));
			if (!raw) {
				values[k] = null;
			} else {
				const n = Number(raw);
				if (!Number.isFinite(n)) errors[k] = 'מספר לא תקין';
				else values[k] = n;
			}
		}
	}

	if (Object.keys(errors).length) return { values, errors };

	// ── מדיה: העלאה חדשה מחליפה, סימון תיבה מסיר ──
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

	const bannerFiles = /** @type {File[]} */ (
		fd.getAll('banners').filter((f) => f && typeof f !== 'string' && f.size > 0)
	);
	if (bannerFiles.length > MAX_BANNERS) {
		errors.banners = `אפשר לצרף עד ${MAX_BANNERS} תמונות`;
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
		if (ids.length) values.banners = ids;
	} else if (fd.get('remove_banners') === 'on') {
		values.banners = [];
	}

	return { values, errors };
}
