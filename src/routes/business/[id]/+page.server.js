import { error } from '@sveltejs/kit';
import { getBusiness } from '$lib/server/strapi.js';
import { toBusiness } from '$lib/businessShape.js';

// טעינת עסק בודד לפי documentId יציב (מחליף את array-index השביר). 404 אמיתי.
export async function load({ params }) {
	const b = await getBusiness(params.id);
	if (!b) throw error(404, 'העסק לא נמצא או ממתין לאישור');
	return { business: toBusiness(b) };
}
