import { fail, redirect } from '@sveltejs/kit';
import {
	getBusinessAdmin,
	getUserProfile,
	setUserProfile,
	isPrivileged,
	isSuperAdmin,
	listBusinessesByOwner,
	listPendingBusinesses,
	listPendingReviews,
	listOpenReports
} from '$lib/server/strapi.js';
import {
	approveAd,
	backToPending,
	listAdsByOwner,
	pauseAd,
	rejectAd,
	resumeAd
} from '$lib/server/adsStore.js';
import { getAdStats } from '$lib/server/adStats.js';
import { getBusinessesTotal, invalidatePendingCounts } from '$lib/server/pendingCounts.js';
import { getMonthlyVisitorStats, gaConfigured } from '$lib/server/visitorStats.js';
import { toBusiness } from '$lib/businessShape.js';
import {
	businessOwnerId,
	findMatchesForUser,
	invalidateMatches,
	invalidateUserMatchCount,
	primeUserMatchCount
} from '$lib/server/ownerMatch.js';
import { createClaim, listClaimsByUser } from '$lib/server/claimsStore.js';
import {
	clearSiteProfile,
	getEffectivePhone,
	getSiteProfile,
	setSiteProfile
} from '$lib/server/profileStore.js';
import { canonicalPhoneKey } from '$lib/phoneIL.js';

// כמה פריטים מכל סוג מוצגים בתקציר המודרציה שבאזור האישי (הרשימה המלאה ב-/admin)
const PREVIEW = 5;

/** @param {any[]} arr @param {(x:any)=>any} map */
const preview = (arr, map) => ({ count: arr.length, items: arr.slice(0, PREVIEW).map(map) });

/**
 * האזור האישי — רק למחוברים. מקור-האמת הוא ה-session (locals.user מ-hooks).
 * טוען לכל משתמש את הכרטיסיות והפרסומות שלו — כולל הסטטיסטיקה שלהן (צפיות,
 * חשיפות טלפון, דירוג; ולמודעות: חשיפות, קליקים ופניות) — ולאדמין גם את
 * תקציר המודרציה ואת סטטיסטיקת הכניסות, בלי להיכנס ל-/admin.
 *
 * בנוסף: "כרטיסיות שנראות שלך" — כרטיסיות בלי בעלים שהטלפון או האימייל
 * שלהן תואמים למשתמש. זו הצעה בלבד; הבעלות ניתנת רק באישור אדמין.
 * @type {import('./$types').PageServerLoad}
 */
export async function load({ locals, parent }) {
	const user = locals.user;
	if (!user) throw redirect(302, '/auth/login');

	const isAdmin = isPrivileged(user);
	// מוני ההמתנה (הבועה על תמונת הפרופיל ועל האריחים) כבר חושבו ב-+layout.server
	const { pending } = await parent();

	// הפרופיל שהאתר הזה מציג: הדריסה המקומית ("רק כאן") אם קיימת, אחרת
	// הרשומה המשותפת של כל אתרי יוצאים לחירות. הטלפון הוא גם מפתח הזיהוי
	// של כרטיסיות ותיקות שאין להן בעלים.
	const [localProfile, networkProfile] = await Promise.all([
		getSiteProfile(user.id).catch(() => null),
		getUserProfile(user.id).catch(() => ({ name: '', phone: '' }))
	]);
	const phone = localProfile?.phone || networkProfile.phone;
	const myName = localProfile?.name || networkProfile.name || user.name;

	const [businesses, ads, moderation, gaMonthly, businessesTotal, matches, myClaims] =
		await Promise.all([
			listBusinessesByOwner({ id: user.id }).catch(() => []),
			listAdsByOwner({ id: user.id, email: user.email }),
			isAdmin ? loadModeration() : Promise.resolve(null),
			isAdmin ? getMonthlyVisitorStats().catch(() => null) : Promise.resolve(null),
			isAdmin ? getBusinessesTotal().catch(() => 0) : Promise.resolve(0),
			findMatchesForUser({ id: user.id, email: user.email, phone }),
			listClaimsByUser(user.id).catch(() => [])
		]);

	// מדדי המודעות של המשתמש (חשיפות/קליקים/דף נחיתה/פניות) — נשלפים רק
	// כשיש לו מודעות, וכולם מאותה קריאה אחת.
	const adStats = await getAdStats(ads.map((a) => a.id)).catch(
		() => /** @type {Record<string, import('$lib/server/adStats.js').AdStats>} */ ({})
	);

	const myBusinesses = businesses.map((b) => ({
		...toBusiness(b),
		status: b.status || 'pending'
	}));

	// לוח ההתאמות כאן טרי; הבועה שבהאדר נשענת על מטמון של עשר דקות —
	// מיישרים אותה לפי מה שהדף עצמו מציג, שלא יופיע "1" בלי שום פריט.
	const matchBoard = buildMatchBoard(matches, myClaims);
	primeUserMatchCount(user.id, matchBoard.filter((m) => !m.claimStatus).length);

	return {
		user,
		// isAdmin מחושב בשרת (isPrivileged) — הלקוח רק מציג; ההרשאה נאכפת ב-/admin עצמו.
		isAdmin,
		superAdmin: isSuperAdmin(user),
		myBusinesses,
		// הפרופיל הניתן לעריכה כאן. scope מספר מאיפה הערכים הנוכחיים באו,
		// ו-network הוא מה ששמור ברשומה המשותפת — כדי שנוכל להראות למשתמש
		// שיש לו שם/טלפון אחר בשאר אתרי הרשת.
		myProfile: {
			name: myName,
			phone,
			scope: localProfile?.name || localProfile?.phone ? 'site' : 'all',
			network: networkProfile
		},
		// הטלפון של המשתמש עצמו — משמש למנוע ההתאמה
		myPhone: phone,
		// כרטיסיות שנראות שלו + מצב הבקשה על כל אחת
		myMatches: matchBoard,
		// סיכום הנכסים של המשתמש — הכותרת של אזור הסטטיסטיקה האישי
		myTotals: {
			views: myBusinesses.reduce((s, b) => s + (b.view_count || 0), 0),
			reveals: myBusinesses.reduce((s, b) => s + (b.phone_reveal_count || 0), 0),
			reviews: myBusinesses.reduce((s, b) => s + (b.rating_count || 0), 0),
			adImpressions: Object.values(adStats).reduce((s, st) => s + st.totals.impressions, 0),
			adClicks: Object.values(adStats).reduce((s, st) => s + st.totals.clicks, 0),
			adLeads: Object.values(adStats).reduce((s, st) => s + st.totals.leads, 0)
		},
		myAds: ads.map((a) => ({
			id: a.id,
			title: a.title,
			status: a.status,
			submittedAt: a.submittedAt,
			expiresAt: a.expiresAt ?? '',
			rejectionReason: a.rejectionReason ?? '',
			// מוצגת עכשיו באתר: מאושרת, לא מושהית ותוקפה לא פג (כמו listApprovedLive)
			live:
				a.status === 'approved' &&
				!a.paused &&
				(!a.expiresAt || new Date(a.expiresAt).getTime() > Date.now()),
			paused: Boolean(a.paused),
			// לקיצורי הניהול: המסלול שהמפרסם ביקש בשליחה, והפרסומת שהגרסה הזו מעדכנת
			requestedDurationDays: a.requestedDurationDays,
			replacesTitle: a.replacesTitle ?? '',
			stats: adStats[a.id]?.totals ?? { impressions: 0, clicks: 0, landing: 0, leads: 0 }
		})),
		moderation,
		// לפאנל הניהול הפרוס: מונה הכרטיסיות לאריח, וסטטיסטיקת הכניסות
		businessesTotal,
		pendingCounts: pending,
		gaConfigured: isAdmin ? gaConfigured() : false,
		gaMonths: gaMonthly?.rows ?? null,
		gaUpdatedAt: gaMonthly?.updatedAt ?? null
	};
}

/**
 * מאחד את ההתאמות שהמערכת מצאה עם הבקשות שהמשתמש כבר שלח: התאמה שכבר
 * נדרשה מוצגת כ"ממתין לאישור", ובקשה פתוחה על כרטיסייה שכבר לא מתאימה
 * (למשל אחרי שינוי טלפון) עדיין מוצגת — כדי שלא תיעלם בלי הסבר.
 * @param {import('$lib/server/ownerMatch.js').BizMatch[]} matches
 * @param {import('$lib/server/claimsStore.js').Claim[]} claims
 */
function buildMatchBoard(matches, claims) {
	/** @type {Map<string, any>} */
	const byDoc = new Map();
	for (const m of matches) {
		const claim = claims.find((c) => c.bizDocId === m.documentId);
		// בקשה שהוכרעה לרעה או שהאדמין התעלם ממנה — לא מציקים למשתמש שוב
		if (claim && claim.status !== 'pending') continue;
		byDoc.set(m.documentId, { ...m, claimStatus: claim ? 'pending' : '' });
	}
	for (const c of claims) {
		if (c.status !== 'pending' || byDoc.has(c.bizDocId)) continue;
		byDoc.set(c.bizDocId, {
			documentId: c.bizDocId,
			name: c.bizName,
			city: '',
			category: '',
			status: 'approved',
			matchedBy: c.matchedBy,
			claimStatus: 'pending'
		});
	}
	return [...byDoc.values()];
}

/** תקציר המודרציה לאדמין — מונים + הפריטים האחרונים מכל סוג. */
async function loadModeration() {
	const [businesses, reviews, reports] = await Promise.all([
		listPendingBusinesses().catch(() => []),
		listPendingReviews().catch(() => []),
		listOpenReports().catch(() => [])
	]);
	return {
		businesses: preview(businesses, (b) => ({
			documentId: b.documentId,
			name: b.name || '',
			category: b.category || '',
			contact_name: b.contact_name || '',
			phone: b.phone || '',
			createdAt: b.createdAt || ''
		})),
		reviews: preview(reviews, (r) => ({
			documentId: r.documentId,
			business: r.business?.name || '',
			rating: Number(r.rating || 0),
			title: r.title || '',
			author: r.author_name || '',
			createdAt: r.submitted_at || r.createdAt || ''
		})),
		reports: preview(reports, (r) => ({
			documentId: r.documentId,
			business: r.business_name || '',
			reason: r.reason || '',
			reporter: r.reporter_name || '',
			createdAt: r.createdAt || ''
		}))
	};
}

/**
 * קיצורי הניהול מ"הפרסומות שלי" — לאדמין שגם מפרסם בעצמו, כדי לא לעבור
 * למסך הניהול בשביל פרסומת אחת. אותן פונקציות בדיוק כמו ב-/admin/ads;
 * ההרשאה נבדקת בתוך כל פעולה, לא רק ב-load. כל התוצאות באותה צורה:
 * { message } בהצלחה, fail עם { error } בכישלון.
 * @param {any} locals
 * @param {Request} request
 * @returns {Promise<{ id: string, form: FormData, by: string } | { error: string, status: number }>}
 */
async function adAction(locals, request) {
	if (!isPrivileged(locals.user)) return { error: 'נדרשת הרשאת ניהול', status: 403 };
	const form = await request.formData();
	const id = String(form.get('id') ?? '');
	if (!id) return { error: 'חסר מזהה פרסומת', status: 400 };
	return { id, form, by: String(locals.user?.email ?? '') };
}

/** @type {import('./$types').Actions} */
export const actions = {
	// אישור (או חידוש של פרסומת שפג תוקפה — אותה פעולה, תוקף חדש מהיום).
	// המסלול = מה שהמפרסם בחר בשליחה (הבחירה המפורשת נשארת במסך הניהול).
	approve: async ({ request, locals }) => {
		const a = await adAction(locals, request);
		if ('error' in a) return fail(a.status, { error: a.error });
		const durRaw = Number(a.form.get('durationDays'));
		const durationDays = durRaw === 180 ? 180 : durRaw === 30 ? 30 : undefined;
		try {
			const r = await approveAd(a.id, a.by, durationDays);
			if (!r) return fail(404, { error: 'הפרסומת לא נמצאה' });
			invalidatePendingCounts();
			return {
				message: r.replacedNowTitle
					? `אושרה ופורסמה: ${r.title} — נכנסה במקום "${r.replacedNowTitle}", שירדה מהאתר`
					: `אושרה ופורסמה: ${r.title} ✅`
			};
		} catch (err) {
			console.error('profile approve failed:', err);
			return fail(502, { error: 'האישור נכשל - נסו שוב' });
		}
	},
	reject: async ({ request, locals }) => {
		const a = await adAction(locals, request);
		if ('error' in a) return fail(a.status, { error: a.error });
		const reason = String(a.form.get('reason') ?? '') || undefined;
		try {
			const r = await rejectAd(a.id, a.by, reason);
			if (!r) return fail(404, { error: 'הפרסומת לא נמצאה' });
			invalidatePendingCounts();
			return { message: `נדחתה: ${r.title}` };
		} catch (err) {
			console.error('profile reject failed:', err);
			return fail(502, { error: 'הדחייה נכשלה - נסו שוב' });
		}
	},
	// השהיה — יורדת מהאתר והימים שנותרו נשמרים לה
	pause: async ({ request, locals }) => {
		const a = await adAction(locals, request);
		if ('error' in a) return fail(a.status, { error: a.error });
		try {
			const r = await pauseAd(a.id);
			if (!r) return fail(404, { error: 'הפרסומת לא נמצאה' });
			return { message: `${r.title} הושהתה - ${r.daysLeft} ימים שמורים לה` };
		} catch (err) {
			console.error('profile pause failed:', err);
			return fail(502, { error: 'ההשהיה נכשלה - נסו שוב' });
		}
	},
	// המשך אחרי השהיה — הימים השמורים נספרים מהיום
	resume: async ({ request, locals }) => {
		const a = await adAction(locals, request);
		if ('error' in a) return fail(a.status, { error: a.error });
		try {
			const r = await resumeAd(a.id);
			if (!r) return fail(404, { error: 'הפרסומת לא נמצאה' });
			return { message: `${r.title} חזרה לאוויר - ${r.daysLeft} ימים` };
		} catch (err) {
			console.error('profile resume failed:', err);
			return fail(502, { error: 'ההפעלה מחדש נכשלה - נסו שוב' });
		}
	},
	// הורדה מהאתר בלי מחיקה — חוזרת לממתינות
	unapprove: async ({ request, locals }) => {
		const a = await adAction(locals, request);
		if ('error' in a) return fail(a.status, { error: a.error });
		try {
			const r = await backToPending(a.id);
			if (!r) return fail(404, { error: 'הפרסומת לא נמצאה' });
			invalidatePendingCounts();
			return { message: 'הפרסומת הורדה מהאתר וחזרה לממתינות' };
		} catch (err) {
			console.error('profile unapprove failed:', err);
			return fail(502, { error: 'ההורדה נכשלה - נסו שוב' });
		}
	},

	/**
	 * שמירת הפרופיל — שם תצוגה וטלפון. שתי הרחבות חשובות:
	 *
	 * 1. scope: רשימת המשתמשים משותפת לכל אתרי יוצאים לחירות, ולכן כל
	 *    כתיבה לרשומה ב-Strapi *היא* שינוי בכל האתרים. המשתמש נשאל לאן
	 *    השינוי הולך: 'all' → הרשומה המשותפת (והדריסה המקומית נמחקת),
	 *    'site' → רק כאן (profileStore).
	 * 2. האימייל אינו ניתן לעריכה: הוא מזהה ההתחברות (Google/SSO), ושינוי
	 *    שלו היה מנתק את המשתמש מהחשבון ומכל הכרטיסיות ששויכו אליו.
	 *
	 * הטלפון אינו מאומת ב-SMS — הוא משמש להצעת התאמה בלבד, והבעלות עצמה
	 * ניתנת רק באישור אדמין.
	 */
	saveProfile: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { profileError: 'נדרשת התחברות' });
		const fd = await request.formData();
		const name = String(fd.get('name') ?? '')
			.trim()
			.slice(0, 60);
		const phone = String(fd.get('phone') ?? '').trim();
		const scope = String(fd.get('scope') ?? '') === 'site' ? 'site' : 'all';

		if (name.length < 2) return fail(400, { profileError: 'השם חייב להכיל לפחות שני תווים' });
		if (phone && !canonicalPhoneKey(phone)) {
			return fail(400, { profileError: 'מספר טלפון לא תקין' });
		}

		try {
			if (scope === 'all') {
				await setUserProfile(user.id, { name, phone });
				// הערך המשותף החדש הוא הנכון גם כאן — דריסה ישנה הייתה
				// ממשיכה להסתיר אותו דווקא באתר שבו הוא נערך
				await clearSiteProfile(user.id);
			} else {
				await setSiteProfile(user.id, { name, phone });
			}
		} catch (e) {
			return fail(502, {
				profileError: 'השמירה נכשלה: ' + (e instanceof Error ? e.message.slice(0, 120) : '')
			});
		}

		// הפרטים החדשים משנים את תוצאות ההתאמה — גם למשתמש וגם למסך האדמין
		invalidateMatches();
		invalidateUserMatchCount(user.id);

		// מיד אחרי השמירה: כמה כרטיסיות נראות שלו לפי הפרטים החדשים. בלי
		// זה המשתמש מקליד טלפון, רואה "נשמר", ולא יודע שבדיוק עכשיו נמצאה
		// לו כרטיסייה קיימת באתר.
		let matchesFound = 0;
		try {
			const [found, claims] = await Promise.all([
				findMatchesForUser({ id: user.id, email: user.email, phone }),
				listClaimsByUser(user.id)
			]);
			matchesFound = found.filter((m) => !claims.some((c) => c.bizDocId === m.documentId)).length;
		} catch {
			matchesFound = 0;
		}

		return { profileSaved: true, profileScope: scope, matchesFound };
	},

	/** בקשת בעלות על כרטיסייה שהמערכת זיהתה כשייכת למשתמש. */
	claim: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { claimError: 'נדרשת התחברות' });
		const fd = await request.formData();
		const bizDocId = String(fd.get('documentId') ?? '').trim();
		if (!bizDocId) return fail(400, { claimError: 'בקשה לא תקינה' });

		const biz = await getBusinessAdmin(bizDocId);
		if (!biz) return fail(404, { claimError: 'הכרטיסייה לא נמצאה' });
		if (businessOwnerId(biz)) return fail(400, { claimError: 'לכרטיסייה כבר יש בעלים רשום' });

		const phone = await getEffectivePhone(user.id);
		const res = await createClaim({
			bizDocId,
			bizName: biz.name || '',
			userId: user.id,
			userName: user.name,
			userEmail: user.email,
			userPhone: phone,
			matchedBy: canonicalPhoneKey(phone) === canonicalPhoneKey(biz.phone) ? 'phone' : 'email',
			// כבר ווידאנו שאין לכרטיסייה בעלים — בקשה ישנה שאושרה ואז נותקה
			// לא צריכה לחסום בקשה חדשה
			reclaim: true
		});
		if (!res.ok) return fail(400, { claimError: res.error });

		invalidatePendingCounts();
		// הכרטיסייה כבר לא "מחכה לו" — הבועה שבהאדר צריכה לרדת מיד
		invalidateUserMatchCount(user.id);
		return { claimSent: true };
	}
};
