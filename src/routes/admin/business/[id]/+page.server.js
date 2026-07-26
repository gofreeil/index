import { error, fail, redirect } from '@sveltejs/kit';
import {
	isPrivileged,
	isSuperAdmin,
	getBusinessAdmin,
	updateBusiness,
	deleteItem,
	uploadImage
} from '$lib/server/strapi.js';

const STATUSES = ['pending', 'approved', 'rejected', 'frozen'];
const URL_RE = /^https?:\/\/.+/i;

/** @param {FormDataEntryValue|null} v */
const str = (v) => (typeof v === 'string' ? v.trim() : '');

/** @param {string} v */
const normUrl = (v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v);

/** @type {import('./$types').PageServerLoad} */
export async function load({ params, locals }) {
	if (!isPrivileged(locals.user)) throw redirect(302, '/admin');
	const biz = await getBusinessAdmin(params.id);
	if (!biz) throw error(404, 'העסק לא נמצא');
	return { biz, superAdmin: isSuperAdmin(locals.user) };
}

/** @type {import('./$types').Actions} */
export const actions = {
	save: async ({ request, params, locals }) => {
		if (!isPrivileged(locals.user)) return fail(403, { error: 'אין הרשאה' });
		const fd = await request.formData();

		/** @type {Record<string, any>} */
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
			address: str(fd.get('address')),
			city: str(fd.get('city')),
			neighborhood: str(fd.get('neighborhood')),
			sales_area: str(fd.get('sales_area')),
			discount: str(fd.get('discount')),
			status: str(fd.get('status'))
		};

		/** @type {Record<string,string>} */
		const errors = {};
		if (!values.name) errors.name = 'שם העסק חובה';
		if (!STATUSES.includes(values.status)) errors.status = 'סטטוס לא תקין';
		for (const k of ['website', 'whatsapp', 'facebook', 'instagram', 'youtube']) {
			if (values[k] && !URL_RE.test(values[k])) errors[k] = 'קישור לא תקין';
		}

		// קואורדינטות למפה — ריק מוחק, מספר מעדכן
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

		if (Object.keys(errors).length) return fail(400, { errors });

		// ── מדיה: העלאה חדשה מחליפה, checkbox מסיר ──
		const logoFile = fd.get('logo');
		if (logoFile && typeof logoFile !== 'string' && logoFile.size > 0) {
			if (!logoFile.type.startsWith('image/') || logoFile.size > 3_000_000) {
				return fail(400, { errors: { logo: 'קובץ לוגו חייב להיות תמונה עד 3MB' } });
			}
			const id = await uploadImage(logoFile).catch(() => null);
			if (id) values.logo = id;
		} else if (fd.get('remove_logo') === 'on') {
			values.logo = null;
		}

		const bannerFiles = /** @type {File[]} */ (
			fd.getAll('banners').filter((f) => f && typeof f !== 'string' && f.size > 0)
		);
		if (bannerFiles.length > 4) {
			return fail(400, { errors: { banners: 'אפשר לצרף עד 4 תמונות' } });
		}
		if (bannerFiles.length) {
			/** @type {number[]} */
			const ids = [];
			for (const f of bannerFiles) {
				if (!f.type.startsWith('image/') || f.size > 3_000_000) {
					return fail(400, { errors: { banners: 'כל תמונה חייבת להיות קובץ תמונה עד 3MB' } });
				}
				const id = await uploadImage(f).catch(() => null);
				if (id) ids.push(id);
			}
			if (ids.length) values.banners = ids;
		} else if (fd.get('remove_banners') === 'on') {
			values.banners = [];
		}

		try {
			await updateBusiness(params.id, values);
		} catch (e) {
			return fail(502, {
				error: 'השמירה נכשלה: ' + (e instanceof Error ? e.message.slice(0, 140) : '')
			});
		}
		return { saved: true };
	},

	del: async ({ params, locals }) => {
		if (!isSuperAdmin(locals.user)) {
			return fail(403, { error: 'מחיקה לצמיתות שמורה לסופר-אדמין' });
		}
		try {
			await deleteItem('business', params.id);
		} catch (e) {
			return fail(502, {
				error: 'המחיקה נכשלה: ' + (e instanceof Error ? e.message.slice(0, 140) : '')
			});
		}
		throw redirect(303, '/admin?tab=cards');
	}
};
