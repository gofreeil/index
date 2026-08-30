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
	listAdvertisers,
	moveApprovedAd,
	setAdSlot,
	computeAdSlots,
	setAdDuration,
	setAdExpiry,
	normalizeDurationDays,
	pauseAd,
	resumeAd
} from '$lib/server/adsStore.js';

/** @param {string} iso */
const fmtDay = (iso) =>
	new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
import { invalidatePendingCounts } from '$lib/server/pendingCounts.js';

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

	// מספר המקום של כל מאושרת בטור (1..12) — לכותרת הכרטיס בטאב "פורסמו"
	const approvedRaw = approvedRes.status === 'fulfilled' ? approvedRes.value : [];
	const slotMap = computeAdSlots(approvedRaw);

	return {
		user,
		superAdmin: isSuperAdmin(user),
		pending: pendingRes.status === 'fulfilled' ? pendingRes.value : [],
		approved: approvedRaw.map((a) => ({ ...a, slot: slotMap.get(a.id) })),
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
		// כל פעולת מודרציה משנה את מספר הממתינות — מאפסים את המטמון של הבועה
		// האדומה (האדר, אזור אישי, סרגל הניווט) כדי שהמספר יתעדכן מיד.
		invalidatePendingCounts();
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
		// ברירת המחדל לגרסה מעודכנת היא החלפה. keepPrevious הוא המקרה ההפוך:
		// מפרסם שבאמת רוצה שתי פרסומות במקביל ולא שדרג את הקיימת.
		const keepPrevious = String(formData.get('keepPrevious') || '') === '1';
		const r = await runAdAction(() => approveAd(id, user.email, durationDays, { keepPrevious }));
		if ('failResp' in r) return r.failResp;
		// גרסה מעודכנת: המנהל צריך לראות שהישנה ירדה, ולא להישאר בספק אם
		// נוספה פרסומת שנייה לאותו מפרסם
		return {
			success: true,
			message: r.result.replacedNowTitle
				? `אושרה ופורסמה: ${r.result.title} — נכנסה במקום "${r.result.replacedNowTitle}", שירדה מהאתר`
				: `אושרה ופורסמה: ${r.result.title}`
		};
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

	// קציבת תקופת פרסום — נספרת מיום הפרסום. שמורה לסופר-אדמין
	setDuration: async ({ request, locals }) => {
		requireAdmin(locals);
		if (!isSuperAdmin(locals.user)) {
			return fail(403, { error: 'קציבת תקופה שמורה לסופר-אדמין' });
		}
		const formData = await request.formData();
		const id = String(formData.get('id') || '');
		if (!id) return fail(400, { error: 'חסר מזהה' });
		const days = normalizeDurationDays(formData.get('days'));
		try {
			const r = await setAdDuration(id, days);
			if (!r) return fail(404, { error: 'הפרסומת לא נמצאה' });
			const suffix = r.daysLeft < 0 ? ' — התקופה כבר חלפה, הפרסומת ירדה מהאתר' : '';
			return {
				success: true,
				message: `${r.title}: ${days} ימים, עד ${fmtDay(r.expiresAt)}${suffix}`
			};
		} catch (e) {
			return fail(502, {
				error: 'קציבת התקופה נכשלה: ' + (e instanceof Error ? e.message.slice(0, 160) : '')
			});
		}
	},

	// תאריך תפוגה שרירותי מחלון הקציבה — הפרסומת יורדת בסוף היום שנבחר. שמור לסופר-אדמין
	setExpiry: async ({ request, locals }) => {
		requireAdmin(locals);
		if (!isSuperAdmin(locals.user)) {
			return fail(403, { error: 'קביעת תאריך תפוגה שמורה לסופר-אדמין' });
		}
		const formData = await request.formData();
		const id = String(formData.get('id') || '');
		const expires = String(formData.get('expires') || '');
		if (!id || !expires) return fail(400, { error: 'חסר תאריך תפוגה' });
		const d = new Date(`${expires}T23:59:59`);
		if (isNaN(d.getTime())) return fail(400, { error: 'תאריך לא תקין' });
		try {
			const r = await setAdExpiry(id, d.toISOString());
			if (!r) return fail(404, { error: 'הפרסומת לא נמצאה' });
			const suffix = r.daysLeft < 0 ? ' — התאריך שנקבע כבר עבר, הפרסומת ירדה מהאתר' : '';
			return {
				success: true,
				message: `${r.title}: תפוגה נקבעה ל-${fmtDay(r.expiresAt)}${suffix}`
			};
		} catch (e) {
			return fail(502, {
				error: 'קביעת התאריך נכשלה: ' + (e instanceof Error ? e.message.slice(0, 160) : '')
			});
		}
	},

	// השהיה — יורדת מהאתר ושומרת את הימים שנותרו
	pause: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const id = String(formData.get('id') || '');
		if (!id) return fail(400, { error: 'חסר מזהה' });
		try {
			const r = await pauseAd(id);
			if (!r) return fail(404, { error: 'הפרסומת לא נמצאה' });
			return { success: true, message: `${r.title} הושהתה — ${r.daysLeft} ימים שמורים לה` };
		} catch (e) {
			return fail(502, {
				error: 'ההשהיה נכשלה: ' + (e instanceof Error ? e.message.slice(0, 160) : '')
			});
		}
	},

	// המשך אחרי השהיה — הימים השמורים נספרים מהיום
	resume: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const id = String(formData.get('id') || '');
		if (!id) return fail(400, { error: 'חסר מזהה' });
		try {
			const r = await resumeAd(id);
			if (!r) return fail(404, { error: 'הפרסומת לא נמצאה' });
			return {
				success: true,
				message: `${r.title} חזרה לאוויר — ${r.daysLeft} ימים, עד ${fmtDay(r.expiresAt)}`
			};
		} catch (e) {
			return fail(502, {
				error: 'ההפעלה מחדש נכשלה: ' + (e instanceof Error ? e.message.slice(0, 160) : '')
			});
		}
	},

	// החלפת מקום בסדר התצוגה באתר — כל אדמין, לא רק סופר-אדמין
	move: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const id = String(formData.get('id') || '');
		const dir = formData.get('dir') === 'down' ? 'down' : 'up';
		if (!id) return fail(400, { error: 'חסר מזהה' });
		try {
			const r = await moveApprovedAd(id, dir);
			if (!r) return fail(400, { error: 'הפרסומת כבר בקצה הרשימה' });
			return { success: true, message: `${r.title} — מקום ${r.position} מתוך ${r.total}` };
		} catch (e) {
			return fail(502, {
				error: 'החלפת המקום נכשלה: ' + (e instanceof Error ? e.message.slice(0, 160) : '')
			});
		}
	},

	// הצבת פרסומת במקום מספרי בטור (1..12); מקום תפוס — השתיים מתחלפות
	setSlot: async ({ request, locals }) => {
		requireAdmin(locals);
		const formData = await request.formData();
		const id = String(formData.get('id') || '');
		if (!id) return fail(400, { error: 'חסר מזהה' });
		try {
			const r = await setAdSlot(id, Number(formData.get('slot')));
			if (!r) return fail(404, { error: 'הפרסומת לא נמצאה' });
			return {
				success: true,
				message: r.swappedTitle
					? `"${r.title}" עברה למקום ${r.slot}, ו"${r.swappedTitle}" עברה למקום ${r.swappedSlot}`
					: `"${r.title}" עברה למקום ${r.slot}`
			};
		} catch (e) {
			return fail(502, {
				error: 'העברת המקום נכשלה: ' + (e instanceof Error ? e.message.slice(0, 160) : '')
			});
		}
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
