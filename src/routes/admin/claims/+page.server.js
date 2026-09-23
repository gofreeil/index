import { fail, redirect } from '@sveltejs/kit';
import { assignBusinessOwner, getBusinessAdmin, isPrivileged } from '$lib/server/strapi.js';
import {
	createClaim,
	decideClaim,
	dismissMatch,
	invalidateClaims,
	listClaims,
	listPendingClaims
} from '$lib/server/claimsStore.js';
import {
	businessOwnerId,
	invalidateMatches,
	listAutoMatches,
	ownershipByDoc
} from '$lib/server/ownerMatch.js';
import { invalidatePendingCounts } from '$lib/server/pendingCounts.js';
import { sendSms, smsStatus, toMobileE164 } from '$lib/server/sms.js';
import {
	DEFAULT_OWNER_TEMPLATE,
	DEFAULT_TEMPLATE,
	MAX_SMS_CHARS,
	OWNER_PLACEHOLDERS,
	PLACEHOLDERS,
	claimLinks,
	getClaimSmsLog,
	getClaimSmsTemplate,
	getOwnerSmsTemplate,
	recordClaimSms,
	renderClaimSms,
	renderOwnerSms,
	setClaimSmsTemplate,
	setOwnerSmsTemplate,
	smsLogKey
} from '$lib/server/claimSms.js';

// כמה הכרעות אחרונות מוצגות בהיסטוריה
const HISTORY = 20;

/**
 * טיוטת ה-SMS לבעל עסק שהכרטיסייה שויכה אליו — נפתחת בעורך אחרי השיוך
 * (וגם מההיסטוריה), כדי שהאדמין יבדוק ויערוך לפני שהיא יוצאת. הנמען: הנייד
 * שבפרופיל, ואם אין — הנייד שעל הכרטיסייה.
 * @param {string} origin @param {string} template
 * @param {{claimId: string, bizDocId: string, bizName: string, userName: string, userPhone: string, bizPhone: string}} v
 */
function ownerSmsDraft(origin, template, v) {
	const phone = toMobileE164(v.userPhone) ? v.userPhone : v.bizPhone;
	return {
		claimId: v.claimId,
		bizName: v.bizName,
		userName: v.userName,
		phone: toMobileE164(phone) ? phone : '',
		draft: renderOwnerSms(template, origin, v)
	};
}

/**
 * מסך הבעלות: מי דרש כרטיסייה, ואילו התאמות המערכת מצאה בין המשתמשים
 * הרשומים לכרטיסיות שאין להן בעלים. אישור כאן הוא הרגע שבו נכתב השיוך
 * על הרשומה — ומאותו רגע בעל העסק רשאי לערוך את הדף שלו.
 * @type {import('./$types').PageServerLoad}
 */
export async function load({ locals, url }) {
	if (!isPrivileged(locals.user)) throw redirect(302, '/admin');

	const [claims, matches, all, sms, template, smsLog, ownerTemplate] = await Promise.all([
		listPendingClaims().catch(() => []),
		listAutoMatches(),
		listClaims().catch(() => []),
		smsStatus(),
		getClaimSmsTemplate(),
		getClaimSmsLog(),
		getOwnerSmsTemplate()
	]);

	const history = all
		.filter((c) => c.status !== 'pending')
		.sort((a, b) => String(b.decidedAt).localeCompare(String(a.decidedAt)))
		.slice(0, HISTORY);
	// לשיוכים שבהיסטוריה — טיוטת הודעת הבעלות. הטלפון שעל הכרטיסייה נשלף
	// רק כשאין נייד בפרופיל, כדי לא לטעון 20 כרטיסיות בכל כניסה.
	const historyRows = await Promise.all(
		history.map(async (h) => {
			if (h.status !== 'approved') return h;
			const bizPhone = toMobileE164(h.userPhone)
				? ''
				: ((await getBusinessAdmin(h.bizDocId).catch(() => null))?.phone ?? '');
			return {
				...h,
				ownerSms: ownerSmsDraft(url.origin, ownerTemplate, {
					claimId: h.id,
					bizDocId: h.bizDocId,
					bizName: h.bizName,
					userName: h.userName,
					userPhone: h.userPhone,
					bizPhone
				})
			};
		})
	);

	// בקשה על כרטיסייה שכבר יש לה בעלים אינה שיוך אלא *העברה* — האדמין
	// צריך לראות את זה לפני שהוא לוחץ, ולאשר בכפתור נפרד.
	const owners = await ownershipByDoc(claims.map((c) => c.bizDocId));

	/**
	 * הזמנה ב-SMS: לכל התאמה — הנמען (הטלפון שבפרופיל, ובהתאמה לפי אימייל
	 * הטלפון שעל הכרטיסייה), טיוטת ההודעה מהנוסח השמור, ומה כבר נשלח.
	 * הקישורים נבנים כאן (חתומים), כדי שהעורך בדפדפן יקבל טקסט מוכן.
	 * @param {any} m
	 */
	const withSms = (m) => {
		const phone = toMobileE164(m.userPhone) ? m.userPhone : m.bizPhone;
		const links = claimLinks(url.origin, m.bizDocId, m.userId);
		return {
			...m,
			smsPhone: toMobileE164(phone) ? phone : '',
			smsDraft: renderClaimSms(template, {
				name: m.userName,
				business: m.bizName,
				link: links.link,
				decline: links.decline
			}),
			smsSent: smsLog[smsLogKey(m.bizDocId, m.userId)] ?? null
		};
	};

	return {
		sms: {
			...sms,
			template,
			defaultTemplate: DEFAULT_TEMPLATE,
			placeholders: PLACEHOLDERS,
			maxChars: MAX_SMS_CHARS,
			ownerTemplate,
			defaultOwnerTemplate: DEFAULT_OWNER_TEMPLATE,
			ownerPlaceholders: OWNER_PLACEHOLDERS
		},
		claims: claims.map((c) => {
			const owner = owners.get(c.bizDocId);
			const ownerId = owner?.ownerId ?? '';
			return {
				...c,
				// ריק כשאין בעלים, או כשהבעלים הוא הדורש עצמו (בקשה שהתייתרה)
				currentOwnerId: ownerId && ownerId !== c.userId ? ownerId : '',
				currentOwnerEmail: ownerId && ownerId !== c.userId ? (owner?.ownerEmail ?? '') : '',
				alreadyOwner: !!ownerId && ownerId === c.userId
			};
		}),
		// התאמות שאיש עוד לא דרש — הבקשות עצמן כבר מופיעות ברשימה למעלה
		matches: matches.filter((m) => m.claim === 'none').map(withSms),
		history: historyRows
	};
}

/**
 * כותב את השיוך על הכרטיסייה. מאמת מחדש שאין לה כבר בעלים — שני אדמינים
 * שמאשרים במקביל לא יכולים לדרוס זה את זה בלי לשים לב. העברה מבעלים קיים
 * אפשרית, אבל רק בכוונה מפורשת (transfer) — כלומר בלחיצה על "העבר בעלות".
 *
 * השיוך אינו נותן גישה בפועל: בעל העסק עוד יידרש לאשר את תנאי הקהילה
 * לפני העריכה הראשונה שלו (ראו $lib/terms.js ומסך /business/[id]/edit).
 * @param {string} bizDocId @param {string} userId @param {string} userEmail
 * @param {boolean} [transfer]
 * @returns {Promise<{ok: true, name: string, phone: string, from: string} | {ok: false, error: string}>}
 */
async function writeOwner(bizDocId, userId, userEmail, transfer = false) {
	const biz = await getBusinessAdmin(bizDocId);
	if (!biz) return { ok: false, error: 'הכרטיסייה לא נמצאה' };
	const current = businessOwnerId(biz);
	if (current && current !== String(userId) && !transfer) {
		return {
			ok: false,
			error: `לכרטיסייה כבר יש בעלים (משתמש #${current}). להעברה יש להשתמש בכפתור "אשר והעבר בעלות".`
		};
	}
	try {
		await assignBusinessOwner(bizDocId, { id: userId, email: userEmail });
	} catch (e) {
		return {
			ok: false,
			error: 'השיוך נכשל: ' + (e instanceof Error ? e.message.slice(0, 140) : '')
		};
	}
	return {
		ok: true,
		name: biz.name || '',
		phone: biz.phone || '',
		from: current && current !== String(userId) ? current : ''
	};
}

/** מאפס את כל המטמונים שנוגעים לבעלות — הבועה והרשימות מתעדכנות מיד. */
function refreshCaches() {
	invalidateClaims();
	invalidateMatches();
	invalidatePendingCounts();
}

/** @type {import('./$types').Actions} */
export const actions = {
	/**
	 * אישור בקשה: כותב את השיוך ואז מסמן את הבקשה כמאושרת. כשהכרטיסייה
	 * כבר משויכת למישהו אחר, האישור הוא העברת בעלות — והוא נדרש להגיע
	 * מהכפתור שמצהיר על כך (transfer=1).
	 */
	approve: async ({ request, locals, url }) => {
		if (!isPrivileged(locals.user)) return fail(403, { error: 'אין הרשאה' });
		const fd = await request.formData();
		const claimId = String(fd.get('claimId') ?? '');
		const transfer = fd.get('transfer') === '1';
		const claim = (await listPendingClaims()).find((c) => c.id === claimId);
		if (!claim) return fail(404, { error: 'הבקשה לא נמצאה' });

		const written = await writeOwner(claim.bizDocId, claim.userId, claim.userEmail, transfer);
		if (!written.ok) return fail(502, { error: written.error });

		try {
			await decideClaim(claimId, 'approved', locals.user?.email ?? '');
		} catch (e) {
			// השיוך כבר נכתב — הכרטיסייה שייכת לו; רק סימון הבקשה נכשל
			return fail(502, {
				error: 'השיוך בוצע אך עדכון הבקשה נכשל: ' + (e instanceof Error ? e.message : '')
			});
		}
		refreshCaches();
		return {
			ok: true,
			message: written.from
				? `${claim.bizName || 'הכרטיסייה'} הועברה ממשתמש #${written.from} ל-${claim.userEmail}`
				: `${claim.bizName || 'הכרטיסייה'} שויכה ל-${claim.userEmail}`,
			ownerSms: ownerSmsDraft(url.origin, await getOwnerSmsTemplate(), {
				claimId,
				bizDocId: claim.bizDocId,
				bizName: written.name || claim.bizName,
				userName: claim.userName,
				userPhone: claim.userPhone,
				bizPhone: written.phone
			})
		};
	},

	/** דחיית בקשה — הכרטיסייה נשארת בלי בעלים. */
	reject: async ({ request, locals }) => {
		if (!isPrivileged(locals.user)) return fail(403, { error: 'אין הרשאה' });
		const fd = await request.formData();
		const claimId = String(fd.get('claimId') ?? '');
		try {
			const decided = await decideClaim(claimId, 'rejected', locals.user?.email ?? '');
			if (!decided) return fail(404, { error: 'הבקשה לא נמצאה' });
		} catch (e) {
			return fail(502, { error: 'העדכון נכשל: ' + (e instanceof Error ? e.message : '') });
		}
		refreshCaches();
		return { ok: true, message: 'הבקשה נדחתה' };
	},

	/**
	 * שיוך יזום מהתאמה שהמערכת מצאה — בלי לחכות שהמשתמש יבקש. נשמרת
	 * רשומת בקשה מאושרת, כדי שתישאר עקבות למי שייך את מי ומתי.
	 */
	assign: async ({ request, locals, url }) => {
		if (!isPrivileged(locals.user)) return fail(403, { error: 'אין הרשאה' });
		const fd = await request.formData();
		const bizDocId = String(fd.get('bizDocId') ?? '');
		const userId = String(fd.get('userId') ?? '');
		const userEmail = String(fd.get('userEmail') ?? '');
		const userName = String(fd.get('userName') ?? '');
		const matchedBy = fd.get('matchedBy') === 'email' ? 'email' : 'phone';
		if (!bizDocId || !userId) return fail(400, { error: 'בקשה לא תקינה' });

		const written = await writeOwner(bizDocId, userId, userEmail);
		if (!written.ok) return fail(502, { error: written.error });

		const created = await createClaim({
			bizDocId,
			bizName: written.name,
			userId,
			userName,
			userEmail,
			userPhone: String(fd.get('userPhone') ?? ''),
			matchedBy,
			source: 'auto',
			note: 'שיוך יזום של אדמין מתוך התאמה אוטומטית'
		});
		if (created.ok) {
			await decideClaim(created.claim.id, 'approved', locals.user?.email ?? '').catch(() => {});
		}
		refreshCaches();
		return {
			ok: true,
			message: `${written.name || 'הכרטיסייה'} שויכה ל-${userEmail}`,
			ownerSms: created.ok
				? ownerSmsDraft(url.origin, await getOwnerSmsTemplate(), {
						claimId: created.claim.id,
						bizDocId,
						bizName: written.name,
						userName,
						userPhone: String(fd.get('userPhone') ?? ''),
						bizPhone: written.phone
					})
				: null
		};
	},

	/**
	 * הודעת הבעלות לבעל העסק — כפי שהאדמין השאיר אותה בעורך. נבדק רק שהשיוך
	 * אכן אושר, שההודעה לא ריקה ולא ארוכה מדי, ושהנמען הוא נייד.
	 */
	ownerSms: async ({ request, locals }) => {
		if (!isPrivileged(locals.user)) return fail(403, { error: 'אין הרשאה' });
		const fd = await request.formData();
		const claim = (await listClaims()).find((c) => c.id === String(fd.get('claimId') ?? ''));
		if (!claim || claim.status !== 'approved') return fail(404, { error: 'השיוך לא נמצא' });
		const phone = String(fd.get('phone') ?? '');
		const message = String(fd.get('message') ?? '').trim();
		if (!toMobileE164(phone)) return fail(400, { error: 'אין לנמען מספר נייד תקין' });
		if (!message) return fail(400, { error: 'ההודעה ריקה' });
		if (message.length > MAX_SMS_CHARS) {
			return fail(400, { error: `ההודעה ארוכה מדי (עד ${MAX_SMS_CHARS} תווים)` });
		}
		const sent = await sendSms({ phone, name: claim.userName, message });
		if (!sent.ok) return fail(502, { error: 'ה-SMS לא נשלח: ' + sent.error });
		return { ok: true, message: `נשלח SMS אל ${phone}` };
	},

	/** נוסח הודעת הבעלות — משותף לכל האדמינים; ריק מחזיר לברירת המחדל. */
	saveOwnerTemplate: async ({ request, locals }) => {
		if (!isPrivileged(locals.user)) return fail(403, { error: 'אין הרשאה' });
		const fd = await request.formData();
		try {
			const res = await setOwnerSmsTemplate(String(fd.get('template') ?? ''));
			if (!res.ok) return fail(400, { error: res.error });
		} catch (e) {
			return fail(502, { error: 'השמירה נכשלה: ' + (e instanceof Error ? e.message : '') });
		}
		return { ok: true, message: 'נוסח הודעת הבעלות נשמר' };
	},

	/** "התעלם" — ההתאמה לא נכונה; לא תוצג שוב ולא תיספר בבועה. */
	dismiss: async ({ request, locals }) => {
		if (!isPrivileged(locals.user)) return fail(403, { error: 'אין הרשאה' });
		const fd = await request.formData();
		const bizDocId = String(fd.get('bizDocId') ?? '');
		const userId = String(fd.get('userId') ?? '');
		if (!bizDocId || !userId) return fail(400, { error: 'בקשה לא תקינה' });
		try {
			await dismissMatch({
				bizDocId,
				bizName: String(fd.get('bizName') ?? ''),
				userId,
				userEmail: String(fd.get('userEmail') ?? ''),
				decidedBy: locals.user?.email ?? ''
			});
		} catch (e) {
			return fail(502, { error: 'העדכון נכשל: ' + (e instanceof Error ? e.message : '') });
		}
		refreshCaches();
		return { ok: true, message: 'ההתאמה סומנה כלא רלוונטית' };
	},

	/**
	 * הזמנה ב-SMS לבעל העסק לדרוש את הכרטיסייה. ההודעה מגיעה מהעורך כפי
	 * שהאדמין השאיר אותה (הטיוטה נבנתה ב-load מהנוסח השמור), ולכן נבדק רק
	 * שהיא לא ריקה, לא ארוכה מדי, ושהנמען הוא נייד. נרשם ביומן — כדי שהכרטיס
	 * יציג "נשלח" ולא יישלח שוב בטעות.
	 */
	sms: async ({ request, locals }) => {
		if (!isPrivileged(locals.user)) return fail(403, { error: 'אין הרשאה' });
		const fd = await request.formData();
		const bizDocId = String(fd.get('bizDocId') ?? '');
		const userId = String(fd.get('userId') ?? '');
		const phone = String(fd.get('phone') ?? '');
		const message = String(fd.get('message') ?? '').trim();
		if (!bizDocId || !userId) return fail(400, { error: 'בקשה לא תקינה' });
		if (!toMobileE164(phone)) return fail(400, { error: 'אין לנמען מספר נייד תקין' });
		if (!message) return fail(400, { error: 'ההודעה ריקה' });
		if (message.length > MAX_SMS_CHARS) {
			return fail(400, { error: `ההודעה ארוכה מדי (עד ${MAX_SMS_CHARS} תווים)` });
		}

		const sent = await sendSms({ phone, name: String(fd.get('userName') ?? ''), message });
		if (!sent.ok) return fail(502, { error: 'ה-SMS לא נשלח: ' + sent.error });

		await recordClaimSms({ bizDocId, userId, by: locals.user?.email ?? '', phone });
		return { ok: true, message: `נשלח SMS אל ${phone}` };
	},

	/** שמירת נוסח ההודעה — משותף לכל האדמינים; ריק מחזיר לברירת המחדל. */
	saveTemplate: async ({ request, locals }) => {
		if (!isPrivileged(locals.user)) return fail(403, { error: 'אין הרשאה' });
		const fd = await request.formData();
		try {
			const res = await setClaimSmsTemplate(String(fd.get('template') ?? ''));
			if (!res.ok) return fail(400, { error: res.error });
		} catch (e) {
			return fail(502, { error: 'השמירה נכשלה: ' + (e instanceof Error ? e.message : '') });
		}
		return { ok: true, message: 'נוסח ההודעה נשמר' };
	}
};
