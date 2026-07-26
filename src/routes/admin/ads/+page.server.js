// פורט של community/my_new_project/src/routes/admin/ads-review אל index.
// שינויים מול המקור: הרשאות דרך isPrivileged/isSuperAdmin של index (אדמין
// מאשר/דוחה/עורך; מחיקה לצמיתות — סופר-אדמין), בלי תזכורות (מערכת ההודעות
// של הקהילה לא קיימת כאן).
import { fail, redirect } from '@sveltejs/kit';
import { isPrivileged, isSuperAdmin } from '$lib/server/strapi.js';
import {
	listPending,
	listApproved,
	approveAd,
	rejectAd,
	backToPending,
	removeAd,
	updateAdFields,
	getAdsStats,
	listSchedules,
	listAdvertisers
} from '$lib/server/adsStore.js';

/** @param {any} locals */
function requireAdmin(locals) {
	if (!isPrivileged(locals.user)) throw redirect(302, '/admin');
	return locals.user;
}

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals }) {
	const user = requireAdmin(locals);

	const emptyStats = {
		pending: 0,
		rejected: 0,
		approved: 0,
		approvedThisWeek: 0,
		submittedThisWeek: 0,
		total: 0
	};
	const [pendingRes, approvedRes, statsRes, schedulesRes, advertisersRes] =
		await Promise.allSettled([
			listPending(),
			listApproved(),
			getAdsStats(),
			listSchedules(),
			listAdvertisers()
		]);

	const failures = [pendingRes, approvedRes, statsRes, schedulesRes, advertisersRes].filter(
		(r) => r.status === 'rejected'
	);
	for (const f of failures) {
		console.warn(
			'[admin/ads] load failed:',
			f.reason instanceof Error ? f.reason.message : f.reason
		);
	}

	return {
		user,
		superAdmin: isSuperAdmin(user),
		pending: pendingRes.status === 'fulfilled' ? pendingRes.value : [],
		approved: approvedRes.status === 'fulfilled' ? approvedRes.value : [],
		stats: statsRes.status === 'fulfilled' ? statsRes.value : emptyStats,
		schedules: schedulesRes.status === 'fulfilled' ? schedulesRes.value : [],
		advertisers: advertisersRes.status === 'fulfilled' ? advertisersRes.value : [],
		backendUnavailable: failures.length > 0
	};
}

/** @param {FormData} formData */
function parseIds(formData) {
	const raw = formData.getAll('id');
	const single = raw.map((v) => String(v)).filter(Boolean);
	if (single.length > 0) return Array.from(new Set(single));
	const csv = formData.get('ids')?.toString() ?? '';
	return Array.from(
		new Set(
			csv
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean)
		)
	);
}

/**
 * מריץ פעולת מודרציה ומתרגם כשל Strapi להודעה ברורה (403 על טוקן ≠ "לא נמצאה").
 * @param {() => Promise<any>} fn
 * @returns {Promise<{result: any}|{failResp: ReturnType<typeof fail>}>}
 */
async function runAdAction(fn) {
	try {
		const result = await fn();
		if (!result) return { failResp: fail(404, { error: 'הפרסומת לא נמצאה' }) };
		return { result };
	} catch (e) {
		return {
			failResp: fail(502, {
				error: 'הפעולה נכשלה: ' + (e instanceof Error ? e.message.slice(0, 160) : '')
			})
		};
	}
}

/** @type {import('./$types').Actions} */
export const actions = {
	approve: async ({ request, locals }) => {
		const user = requireAdmin(locals);
		const formData = await request.formData();
		const id = String(formData.get('id') || '');
		if (!id) return fail(400, { error: 'חסר מזהה' });
		// תקופת הפרסום שסומנה במסך (ברירת המחדל = מה שהמפרסם ביקש בשליחה)
		const durRaw = Number(formData.get('durationDays'));
		const durationDays = durRaw === 180 ? 180 : durRaw === 30 ? 30 : undefined;
		const r = await runAdAction(() => approveAd(id, user.email, durationDays));
		if ('failResp' in r) return r.failResp;
		return { success: true, message: `אושרה ופורסמה: ${r.result.title}` };
	},

	reject: async ({ request, locals }) => {
		const user = requireAdmin(locals);
		const formData = await request.formData();
		const id = String(formData.get('id') || '');
		const reason = String(formData.get('reason') || '') || undefined;
		if (!id) return fail(400, { error: 'חסר מזהה' });
		const r = await runAdAction(() => rejectAd(id, user.email, reason));
		if ('failResp' in r) return r.failResp;
		return { success: true, message: `נדחתה: ${r.result.title}` };
	},

	bulkApprove: async ({ request, locals }) => {
		const user = requireAdmin(locals);
		const ids = parseIds(await request.formData());
		if (ids.length === 0) return fail(400, { error: 'לא נבחרו פרסומות' });
		let ok = 0;
		for (const id of ids) {
			const r = await approveAd(id, user.email).catch(() => null);
			if (r) ok++;
		}
		return { success: true, message: `אושרו ופורסמו ${ok} פרסומות` };
	},

	bulkReject: async ({ request, locals }) => {
		const user = requireAdmin(locals);
		const formData = await request.formData();
		const ids = parseIds(formData);
		const reason = String(formData.get('reason') || '') || undefined;
		if (ids.length === 0) return fail(400, { error: 'לא נבחרו פרסומות' });
		let ok = 0;
		for (const id of ids) {
			const r = await rejectAd(id, user.email, reason).catch(() => null);
			if (r) ok++;
		}
		return { success: true, message: `נדחו ${ok} פרסומות` };
	},

	// "הורד מהאתר" (מ-פורסמה) וגם "החזר לממתינות" (מ-נדחתה)
	backToPending: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const id = String(formData.get('id') || '');
		if (!id) return fail(400, { error: 'חסר מזהה' });
		const r = await runAdAction(() => backToPending(id));
		if ('failResp' in r) return r.failResp;
		return { success: true, message: `הוחזרה לממתינות: ${r.result.title}` };
	},

	remove: async ({ request, locals }) => {
		requireAdmin(locals);
		if (!isSuperAdmin(locals.user)) {
			return fail(403, { error: 'מחיקה לצמיתות שמורה לסופר-אדמין' });
		}
		const formData = await request.formData();
		const id = String(formData.get('id') || '');
		if (!id) return fail(400, { error: 'חסר מזהה' });
		const ok = await removeAd(id);
		if (!ok) return fail(404, { error: 'הפרסומת לא נמצאה' });
		return { success: true, message: 'נמחקה לצמיתות' };
	},

	update: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const id = String(formData.get('id') || '');
		if (!id) return fail(400, { error: 'חסר מזהה' });
		/** @param {string} k */
		const opt = (k) => {
			const v = formData.get(k);
			return typeof v === 'string' ? v : undefined;
		};
		const r = await runAdAction(() =>
			updateAdFields(id, {
				title: opt('title'),
				subtitle: opt('subtitle'),
				cta: opt('cta'),
				hoverText: opt('hoverText')
			})
		);
		if ('failResp' in r) return r.failResp;
		return { success: true, message: `עודכנה: ${r.result.title}` };
	}
};
