import { fail } from '@sveltejs/kit';
import { createBusiness, uploadImage } from '$lib/server/strapi.js';
import { getCategoryOptions } from '$lib/server/categoryStore.js';
import { parseBranches } from '$lib/branches.js';
import { EXTRA_LINK_KEYS, parseExtraLinks } from '$lib/socialLinks.js';
import { parseMediaFit, MAX_BANNERS } from '$lib/mediaFit.js';

/**
 * רשימת הקטגוריות לתפריט הבחירה — כולל דריסות השם והקטגוריות שהוסיף
 * הסופר-אדמין במסך ניהול הקטגוריות.
 * @type {import('./$types').PageServerLoad}
 */
export async function load() {
	return { categoryOptions: await getCategoryOptions().catch(() => []) };
}

// ── Anti-spam: rate-limit per-IP (token bucket בזיכרון) ──────────
/** @type {Map<string, {count:number, resetAt:number}>} */
const buckets = new Map();
const WINDOW_MS = 60 * 60 * 1000; // שעה
const MAX_PER_WINDOW = 5;

/** @param {string} ip */
function rateLimited(ip) {
	const now = Date.now();
	const b = buckets.get(ip);
	if (!b || now > b.resetAt) {
		buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
		return false;
	}
	if (b.count >= MAX_PER_WINDOW) return true;
	b.count += 1;
	return false;
}

const PHONE_RE = /^0\d[\d\-\s]{6,}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const URL_RE = /^https?:\/\/.+/i;

/** @param {FormDataEntryValue|null} v */
const str = (v) => (typeof v === 'string' ? v.trim() : '');

/** @param {string} v */
const normUrl = (v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v);

export const actions = {
	default: async ({ request, getClientAddress, locals }) => {
		const fd = await request.formData();

		// honeypot — שדה נסתר שבוט ימלא; משתמש אמיתי לא רואה אותו.
		if (str(fd.get('company_website'))) return { success: true };

		// זמן-מילוי מינימלי — הגשה מהירה מדי = בוט.
		const renderedAt = Number(fd.get('form_rendered_at'));
		if (renderedAt && Date.now() - renderedAt < 3000) {
			return fail(400, { error: 'הטופס נשלח מהר מדי, נסו שוב.' });
		}

		if (rateLimited(getClientAddress())) {
			return fail(429, { error: 'נשלחו יותר מדי בקשות מהכתובת הזו. נסו שוב בעוד שעה.' });
		}

		// ── שדות ──
		const values = {
			name: str(fd.get('name')),
			category: str(fd.get('category')),
			subcategory: str(fd.get('subcategory')),
			description: str(fd.get('description')),
			unique_content: str(fd.get('unique_content')),
			contact_name: str(fd.get('contact_name')),
			phone: str(fd.get('phone')),
			email: str(fd.get('email')),
			website: normUrl(str(fd.get('website'))),
			whatsapp: normUrl(str(fd.get('whatsapp'))),
			facebook: normUrl(str(fd.get('facebook'))),
			instagram: normUrl(str(fd.get('instagram'))),
			youtube: normUrl(str(fd.get('youtube'))),
			// טיקטוק, X, לינקדאין, "נוסף" וסרטון התדמית — נשארים ב-values כדי
			// שיחזרו למסך אם הולידציה נכשלה, ונשלחים ל-extra_fields ולא
			// כעמודות (socialLinks.js). youtube למעלה הוא הערוץ, לא הסרטון.
			tiktok: normUrl(str(fd.get('tiktok'))),
			x: normUrl(str(fd.get('x'))),
			linkedin: normUrl(str(fd.get('linkedin'))),
			extra: normUrl(str(fd.get('extra'))),
			video: normUrl(str(fd.get('video'))),
			address: str(fd.get('address')),
			city: str(fd.get('city')),
			neighborhood: str(fd.get('neighborhood')),
			sales_area: str(fd.get('sales_area')),
			discount: str(fd.get('discount')),
			// סניפים ומקומות שירות נוספים — נשארים ב-values כדי שיחזרו למסך
			// אם הולידציה נכשלה, ונשלחים ל-extra_fields ולא כשדה משלהם.
			branches: parseBranches(fd.get('branches'))
		};
		const accepted_terms = fd.get('accepted_terms') === 'on';

		// ── ולידציה בצד-שרת (מקור-האמת) ──
		/** @type {Record<string,string>} */
		const errors = {};
		if (!values.name) errors.name = 'שם העסק חובה';
		if (!values.category) errors.category = 'יש לבחור קטגוריה';
		if (!values.description) errors.description = 'תיאור קצר חובה';
		if (!values.contact_name) errors.contact_name = 'שם איש קשר חובה';
		if (!PHONE_RE.test(values.phone)) errors.phone = 'מספר טלפון לא תקין';
		if (!EMAIL_RE.test(values.email)) errors.email = 'אימייל לא תקין (משמש לעריכה עתידית של העסק)';
		if (!values.address) errors.address = 'כתובת מלאה חובה — דרושה להצגת העסק על המפה';
		if (!values.discount) errors.discount = 'ההטבה הבלעדית לחברי הקהילה חובה';
		if (!accepted_terms) errors.accepted_terms = 'יש לאשר את תנאי הקהילה';
		for (const k of [
			'website',
			'whatsapp',
			'facebook',
			'instagram',
			'youtube',
			...EXTRA_LINK_KEYS
		]) {
			const val = /** @type {any} */ (values)[k];
			if (val && !URL_RE.test(val)) errors[k] = 'קישור לא תקין';
		}

		if (Object.keys(errors).length) {
			return fail(400, { errors, values });
		}

		// ── העלאת לוגו (אופציונלי) ──
		let logoId = null;
		const file = fd.get('logo');
		if (file && typeof file !== 'string' && file.size > 0) {
			if (!file.type.startsWith('image/') || file.size > 3_000_000) {
				return fail(400, { errors: { logo: 'קובץ לוגו חייב להיות תמונה עד 3MB' }, values });
			}
			try {
				logoId = await uploadImage(file);
			} catch {
				logoId = null; // לא לחסום הגשה על כשל העלאה
			}
		}

		// ── העלאת תמונות העסק (banners) ──
		/** @type {number[]} */
		const bannerIds = [];
		const bannerFiles = /** @type {File[]} */ (
			fd.getAll('banners').filter((f) => f && typeof f !== 'string' && f.size > 0)
		);
		if (bannerFiles.length > MAX_BANNERS) {
			return fail(400, { errors: { banners: `אפשר לצרף עד ${MAX_BANNERS} תמונות` }, values });
		}
		for (const f of bannerFiles) {
			if (!f.type.startsWith('image/') || f.size > 3_000_000) {
				return fail(400, {
					errors: { banners: 'כל תמונה חייבת להיות קובץ תמונה עד 3MB' },
					values
				});
			}
			try {
				const id = await uploadImage(f);
				if (id) bannerIds.push(id);
			} catch {
				/* לא לחסום הגשה על כשל העלאה */
			}
		}

		// ── כתיבה ל-Strapi (status=pending נכפה ב-controller) ──
		// לאוסף idx-business אין עמודת email, ו-Strapi מתעלם בשקט ממפתח לא
		// מוכר — ולכן אימייל בעל העסק נשמר ב-extra_fields (עמודת json).
		// זה גם המפתח שבו המערכת מזהה אותו כשהוא נרשם לאתר (ownerMatch.js).
		const { email, branches, tiktok, x, linkedin, extra, video, ...fields } = values;
		const links = parseExtraLinks({ tiktok, x, linkedin, extra, video });
		// מיקום וזום של הלוגו והתמונות — null כשלא נגעו בהם, וכך הוא לא נשמר
		const mediaFit = parseMediaFit(fd.get('media_fit'));
		try {
			await createBusiness({
				...fields,
				extra_fields: {
					owner_email: email.toLowerCase(),
					...(branches.length ? { branches } : {}),
					...(Object.keys(links).length ? { links } : {}),
					...(mediaFit ? { media_fit: mediaFit } : {})
				},
				accepted_terms: true,
				logo: logoId ?? undefined,
				banners: bannerIds.length ? bannerIds : undefined,
				source: 'index-form',
				user: locals.user?.id ?? undefined,
				user_id: locals.user?.id ?? undefined
			});
		} catch (e) {
			console.error('createBusiness failed:', e);
			return fail(502, { error: 'שמירת העסק נכשלה. נסו שוב עוד רגע.', values });
		}

		return { success: true };
	}
};
