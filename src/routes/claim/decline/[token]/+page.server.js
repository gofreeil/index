import { fail } from '@sveltejs/kit';
import { verifyDeclineToken } from '$lib/server/claimSms.js';
import { dismissMatch, invalidateClaims } from '$lib/server/claimsStore.js';
import { invalidateMatches } from '$lib/server/ownerMatch.js';
import { invalidatePendingCounts } from '$lib/server/pendingCounts.js';
import { getBusinessAdmin } from '$lib/server/strapi.js';

/**
 * "לא שלי" — הקישור השני ב-SMS שהאדמין שולח על התאמה אוטומטית. האסימון
 * חתום (ראו claimSms.js), ולכן לא נדרשת התחברות: מי שקיבל את ההודעה הוא
 * מי שמחזיק את הטלפון שעל הכרטיסייה. הסימון עצמו נעשה ב-POST מכפתור —
 * לא ב-GET — כדי שתצוגה מקדימה של הקישור באפליקציית ההודעות לא תסגור
 * את ההתאמה בטעות.
 * @type {import('./$types').PageServerLoad}
 */
export async function load({ params }) {
	const ids = verifyDeclineToken(params.token);
	if (!ids) return { valid: false, bizName: '' };
	const biz = await getBusinessAdmin(ids.bizDocId).catch(() => null);
	return { valid: true, bizName: biz?.name || '' };
}

/** @type {import('./$types').Actions} */
export const actions = {
	default: async ({ params }) => {
		const ids = verifyDeclineToken(params.token);
		if (!ids) return fail(400, { error: 'הקישור אינו תקין' });
		try {
			const biz = await getBusinessAdmin(ids.bizDocId).catch(() => null);
			await dismissMatch({
				bizDocId: ids.bizDocId,
				bizName: biz?.name || '',
				userId: ids.userId,
				decidedBy: 'sms:not-mine'
			});
		} catch (e) {
			return fail(502, { error: 'העדכון נכשל: ' + (e instanceof Error ? e.message : '') });
		}
		invalidateClaims();
		invalidateMatches();
		invalidatePendingCounts();
		return { done: true };
	}
};
