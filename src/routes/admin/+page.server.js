import { fail } from '@sveltejs/kit';
import {
	isPrivileged,
	isSuperAdmin,
	listPendingBusinesses,
	listAllBusinesses,
	listPendingReviews,
	listOpenReports,
	setStatus,
	deleteItem,
	recomputeBusinessRating
} from '$lib/server/strapi.js';
import { countPending as countPendingAds } from '$lib/server/adsStore.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals }) {
	const user = locals.user;
	if (!isPrivileged(user)) return { authorized: false, user: user ?? null };

	const [businesses, allBusinesses, reviews, reports, adsPending] = await Promise.all([
		listPendingBusinesses().catch(() => []),
		listAllBusinesses().catch(() => []),
		listPendingReviews().catch(() => []),
		listOpenReports().catch(() => []),
		countPendingAds()
	]);
	return {
		authorized: true,
		user,
		superAdmin: isSuperAdmin(user),
		businesses,
		allBusinesses,
		reviews,
		reports,
		adsPending
	};
}

/** @type {Record<string,string[]>} */
const VALID = {
	business: ['approved', 'rejected', 'frozen', 'pending'],
	review: ['approved', 'rejected'],
	report: ['reviewing', 'resolved', 'dismissed']
};

/** @type {import('./$types').Actions} */
export const actions = {
	moderate: async ({ request, locals }) => {
		if (!isPrivileged(locals.user)) return fail(403, { error: 'אין הרשאה' });
		const fd = await request.formData();
		const kind = String(fd.get('kind') || '');
		const documentId = String(fd.get('documentId') || '');
		const status = String(fd.get('status') || '');
		if (!documentId || !VALID[kind]?.includes(status)) {
			return fail(400, { error: 'בקשה לא תקינה' });
		}
		try {
			await setStatus(/** @type {any} */ (kind), documentId, status);
		} catch (e) {
			return fail(502, {
				error: 'העדכון נכשל: ' + (e instanceof Error ? e.message.slice(0, 140) : '')
			});
		}
		// אחרי אישור/דחיית ביקורת — חישוב-מחדש של דירוג העסק (הפרונט מחזיק את ה-documentId).
		if (kind === 'review') {
			await recomputeBusinessRating(String(fd.get('businessDocId') || ''));
		}
		return { ok: true, kind, documentId, status };
	},

	// מחיקה לצמיתות — סופר-אדמין בלבד. אדמין רגיל "מסיר" דרך הקפאה/דחייה.
	deleteItem: async ({ request, locals }) => {
		if (!isSuperAdmin(locals.user)) {
			return fail(403, { error: 'מחיקה לצמיתות שמורה לסופר-אדמין' });
		}
		const fd = await request.formData();
		const kind = String(fd.get('kind') || '');
		const documentId = String(fd.get('documentId') || '');
		if (!documentId || !(kind in VALID)) return fail(400, { error: 'בקשה לא תקינה' });
		try {
			await deleteItem(/** @type {any} */ (kind), documentId);
		} catch (e) {
			return fail(502, {
				error: 'המחיקה נכשלה: ' + (e instanceof Error ? e.message.slice(0, 140) : '')
			});
		}
		return { ok: true, deleted: true, kind, documentId };
	}
};
