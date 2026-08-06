import { error, fail, redirect } from '@sveltejs/kit';
import {
	isPrivileged,
	isSuperAdmin,
	getBusinessAdmin,
	updateBusiness,
	deleteItem
} from '$lib/server/strapi.js';
import { parseBusinessForm } from '$lib/server/businessEdit.js';
import { invalidateMatches } from '$lib/server/ownerMatch.js';

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

		// הרשומה הקיימת דרושה למיזוג extra_fields (Strapi מחליף json במלואו)
		const current = await getBusinessAdmin(params.id);
		if (!current) return fail(404, { error: 'העסק לא נמצא' });

		const { values, errors } = await parseBusinessForm(fd, { canModerate: true, current });
		if (Object.keys(errors).length) return fail(400, { errors });

		try {
			await updateBusiness(params.id, values);
		} catch (e) {
			return fail(502, {
				error: 'השמירה נכשלה: ' + (e instanceof Error ? e.message.slice(0, 140) : '')
			});
		}
		// טלפון/אימייל/סטטוס שהשתנו משנים את תוצאות מנוע ההתאמה
		invalidateMatches();
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
		invalidateMatches();
		throw redirect(303, '/admin?tab=cards');
	}
};
