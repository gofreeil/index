import { redirect } from '@sveltejs/kit';
import {
	getUserPhone,
	isPrivileged,
	isSuperAdmin,
	listBusinessesByOwner,
	listPendingBusinesses,
	listPendingReviews,
	listOpenReports
} from '$lib/server/strapi.js';
import { listAdsByOwner } from '$lib/server/adsStore.js';
import { getAdStats } from '$lib/server/adStats.js';
import { getBusinessesTotal } from '$lib/server/pendingCounts.js';
import { getMonthlyVisitorStats, gaConfigured } from '$lib/server/visitorStats.js';
import { toBusiness } from '$lib/businessShape.js';

// כמה פריטים מכל סוג מוצגים בתקציר המודרציה שבאזור האישי (הרשימה המלאה ב-/admin)
const PREVIEW = 5;

/** @param {any[]} arr @param {(x:any)=>any} map */
const preview = (arr, map) => ({ count: arr.length, items: arr.slice(0, PREVIEW).map(map) });

/**
 * האזור האישי — רק למחוברים. מקור-האמת הוא ה-session (locals.user מ-hooks).
 * טוען לכל משתמש את הכרטיסיות והפרסומות שלו — כולל הסטטיסטיקה שלהן (צפיות,
 * חשיפות טלפון, דירוג; ולמודעות: חשיפות, קליקים ופניות) — ולאדמין גם את
 * תקציר המודרציה ואת סטטיסטיקת הכניסות, בלי להיכנס ל-/admin.
 * @type {import('./$types').PageServerLoad}
 */
export async function load({ locals, parent }) {
	const user = locals.user;
	if (!user) throw redirect(302, '/auth/login');

	const isAdmin = isPrivileged(user);
	// מוני ההמתנה (הבועה על תמונת הפרופיל ועל האריחים) כבר חושבו ב-+layout.server
	const { pending } = await parent();
	// הטלפון מהפרופיל מאתר גם כרטיסיות ותיקות שנוצרו לפני שהיה שיוך-משתמש
	const phone = await getUserPhone(user.id);

	const [businesses, ads, moderation, gaMonthly, businessesTotal] = await Promise.all([
		listBusinessesByOwner({ id: user.id, phone }).catch(() => []),
		listAdsByOwner({ id: user.id, email: user.email }),
		isAdmin ? loadModeration() : Promise.resolve(null),
		isAdmin ? getMonthlyVisitorStats().catch(() => null) : Promise.resolve(null),
		isAdmin ? getBusinessesTotal().catch(() => 0) : Promise.resolve(0)
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
