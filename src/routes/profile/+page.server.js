import { fail, redirect } from '@sveltejs/kit';
import {
	getBusinessAdmin,
	getUserPhone,
	setUserPhone,
	isPrivileged,
	isSuperAdmin,
	listBusinessesByOwner,
	listPendingBusinesses,
	listPendingReviews,
	listOpenReports
} from '$lib/server/strapi.js';
import { listAdsByOwner } from '$lib/server/adsStore.js';
import { getAdStats } from '$lib/server/adStats.js';
import { getBusinessesTotal, invalidatePendingCounts } from '$lib/server/pendingCounts.js';
import { getMonthlyVisitorStats, gaConfigured } from '$lib/server/visitorStats.js';
import { toBusiness } from '$lib/businessShape.js';
import { businessOwnerId, findMatchesForUser, invalidateMatches } from '$lib/server/ownerMatch.js';
import { createClaim, listClaimsByUser } from '$lib/server/claimsStore.js';
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
	// הטלפון מהפרופיל הוא מפתח הזיהוי של כרטיסיות ותיקות שאין להן בעלים
	const phone = await getUserPhone(user.id);

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

	return {
		user,
		// isAdmin מחושב בשרת (isPrivileged) — הלקוח רק מציג; ההרשאה נאכפת ב-/admin עצמו.
		isAdmin,
		superAdmin: isSuperAdmin(user),
		myBusinesses,
		// הטלפון של המשתמש עצמו — ניתן לעריכה כאן, ומשמש למנוע ההתאמה
		myPhone: phone,
		// כרטיסיות שנראות שלו + מצב הבקשה על כל אחת
		myMatches: buildMatchBoard(matches, myClaims),
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

/** @type {import('./$types').Actions} */
export const actions = {
	/**
	 * שמירת הטלפון בפרופיל המשתמש. אין אימות SMS — המספר משמש להצעת
	 * התאמה בלבד, והבעלות עצמה ניתנת רק באישור אדמין.
	 */
	savePhone: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { phoneError: 'נדרשת התחברות' });
		const fd = await request.formData();
		const phone = String(fd.get('phone') ?? '').trim();
		if (phone && !canonicalPhoneKey(phone)) {
			return fail(400, { phoneError: 'מספר טלפון לא תקין' });
		}
		try {
			await setUserPhone(user.id, phone);
		} catch (e) {
			return fail(502, {
				phoneError: 'השמירה נכשלה: ' + (e instanceof Error ? e.message.slice(0, 120) : '')
			});
		}
		// המספר החדש משנה את תוצאות ההתאמה — גם למשתמש וגם למסך האדמין
		invalidateMatches();
		return { phoneSaved: true };
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

		const phone = await getUserPhone(user.id);
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
		return { claimSent: true };
	}
};
