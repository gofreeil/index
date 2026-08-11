import { error, fail, redirect } from '@sveltejs/kit';
import { getBusinessAdmin, updateBusiness, isPrivileged } from '$lib/server/strapi.js';
import { getCategoryOptions, liveCategory } from '$lib/server/categoryStore.js';
import { canEditBusiness, isBusinessOwner, invalidateMatches } from '$lib/server/ownerMatch.js';
import { parseBusinessForm } from '$lib/server/businessEdit.js';

/**
 * עריכת כרטיסייה בידי בעליה. הבעלות נקבעת בשרת בלבד (שיוך שנכתב על
 * הרשומה — לא התאמת טלפון), ולכן אין כאן מה לזייף מהדפדפן. אדמין נכנס
 * לאותו מסך על כל כרטיסייה, ורק לו מוצגים שדות הניהול.
 *
 * getBusinessAdmin ולא getBusiness — בעל עסק צריך לערוך את הכרטיסייה שלו
 * גם כשהיא עדיין ממתינה לאישור או מוקפאת.
 * @type {import('./$types').PageServerLoad}
 */
export async function load({ params, locals }) {
	if (!locals.user) throw redirect(302, '/auth/login');
	const biz = await getBusinessAdmin(params.id);
	if (!biz) throw error(404, 'העסק לא נמצא');
	if (!canEditBusiness(biz, locals.user)) {
		throw error(403, 'רק בעל הכרטיסייה (או אדמין) רשאי לערוך אותה');
	}
	const [categoryOptions, category] = await Promise.all([
		getCategoryOptions().catch(() => []),
		// תווית של קטגוריה שנמחקה ממסך הניהול כבר לא קיימת — הטופס מציג את
		// הסיווג החי (מה שהאתר מראה) כדי לא לשמור אותה שוב
		liveCategory(biz).catch(() => biz.category ?? '')
	]);
	return {
		biz: { ...biz, category },
		isAdmin: isPrivileged(locals.user),
		isOwner: isBusinessOwner(biz, locals.user),
		categoryOptions
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	save: async ({ request, params, locals }) => {
		if (!locals.user) return fail(401, { error: 'נדרשת התחברות' });

		// נטען מחדש ולא נסמכים על ה-load: ההרשאה נבדקת מול המצב בזמן
		// השמירה, וה-extra_fields הקיים דרוש למיזוג (Strapi מחליף json במלואו).
		const current = await getBusinessAdmin(params.id);
		if (!current) return fail(404, { error: 'העסק לא נמצא' });
		if (!canEditBusiness(current, locals.user)) return fail(403, { error: 'אין הרשאה' });

		const canModerate = isPrivileged(locals.user);
		const fd = await request.formData();
		const { values, errors } = await parseBusinessForm(fd, { canModerate, current });
		if (Object.keys(errors).length) return fail(400, { errors });

		try {
			await updateBusiness(params.id, values);
		} catch (e) {
			return fail(502, {
				error: 'השמירה נכשלה: ' + (e instanceof Error ? e.message.slice(0, 140) : '')
			});
		}
		// טלפון/אימייל שהשתנו משנים את תוצאות מנוע ההתאמה
		invalidateMatches();
		return { saved: true };
	}
};
