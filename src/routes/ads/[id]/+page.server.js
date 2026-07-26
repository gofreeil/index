import { error } from '@sveltejs/kit';
import { getAd } from '$lib/server/adsStore.js';

// דף נחיתה ציבורי לפרסומת (פורט מהקהילה) — רק פרסומות מאושרות.
/** @type {import('./$types').PageServerLoad} */
export async function load({ params }) {
	const ad = await getAd(params.id);
	if (!ad || ad.status !== 'approved') {
		throw error(404, 'הפרסומת לא נמצאה');
	}
	return { ad };
}
