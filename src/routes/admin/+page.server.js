import { fail } from '@sveltejs/kit';
import {
	isPrivileged,
	listPendingBusinesses,
	listPendingReviews,
	listOpenReports,
	setStatus,
	recomputeBusinessRating
} from '$lib/server/strapi.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals }) {
	const user = locals.user;
	if (!isPrivileged(user)) return { authorized: false, user: user ?? null };

	const [businesses, reviews, reports] = await Promise.all([
		listPendingBusinesses().catch(() => []),
		listPendingReviews().catch(() => []),
		listOpenReports().catch(() => [])
	]);
	return { authorized: true, user, businesses, reviews, reports };
}

/** @type {Record<string,string[]>} */
const VALID = {
	business: ['approved', 'rejected', 'frozen'],
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
	}
};
