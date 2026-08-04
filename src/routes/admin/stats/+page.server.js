import { redirect } from '@sveltejs/kit';
import { isPrivileged } from '$lib/server/strapi.js';
import {
	getMonthlyVisitorStats,
	getYearlyInsights,
	gaConfigured
} from '$lib/server/visitorStats.js';
import { getDirectoryStats, resolveBusinessPages } from '$lib/server/siteStats.js';
import { getAdStatsTotals } from '$lib/server/adStats.js';

/**
 * מסך הסטטיסטיקה — פתוח לכל אדמין. שני מקורות נתונים:
 *   • Google Analytics (visitorStats) — כניסות, ערים, מכשירים, מקורות תנועה.
 *     דורש הגדרה; בלעדיה המסך מציג את מה שכן יש ומסביר מה חסר.
 *   • המאגר עצמו (siteStats) — גידול, כרטיסיות נצפות, חשיפות טלפון, דירוגים.
 *     עובד תמיד, בלי הגדרות.
 * כל מקור נכשל בנפרד ולא מפיל את המסך.
 * @type {import('./$types').PageServerLoad}
 */
export async function load({ locals }) {
	if (!isPrivileged(locals.user)) throw redirect(302, '/admin');

	const [monthly, insights, directory, adTotals] = await Promise.all([
		getMonthlyVisitorStats().catch(() => null),
		getYearlyInsights().catch(() => null),
		getDirectoryStats().catch(() => null),
		getAdStatsTotals().catch(() => null)
	]);

	// נתיבי /business/{id} מ-GA → שמות כרטיסיות
	const topPages = await resolveBusinessPages(insights?.data.businessPages ?? []).catch(() => []);

	return {
		gaConfigured: gaConfigured(),
		months: monthly?.rows ?? null,
		gaUpdatedAt: monthly?.updatedAt ?? null,
		insightsAvailable: insights !== null,
		topPages,
		cities: insights?.data.cities ?? [],
		devices: insights?.data.devices ?? [],
		channels: insights?.data.channels ?? [],
		directory,
		adTotals
	};
}
