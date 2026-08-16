import { error } from '@sveltejs/kit';
import { getAd, withAdImageUrls } from '$lib/server/adsStore.js';

// דף נחיתה ציבורי לפרסומת (פורט מהקהילה) — רק פרסומות מאושרות.
/** @type {import('./$types').PageServerLoad} */
export async function load({ params }) {
	const ad = await getAd(params.id);
	if (!ad || ad.status !== 'approved') {
		throw error(404, 'הפרסומת לא נמצאה');
	}
	// התמונות ככתובת ולא מוטבעות — הדף החזיר את הרשומה המלאה וסחב אותן
	// בכל צפייה (1,218KB, 95% מהם base64). ראו withAdImageUrls.
	return { ad: withAdImageUrls(ad) };
}
