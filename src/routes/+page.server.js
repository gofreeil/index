import { listApprovedBusinesses } from '$lib/server/strapi.js';
import { toBusiness } from '$lib/businessShape.js';

// ============================================================
// טעינת האינדקס בצד-השרת (SSR).
// עד כאן הרשימה נשלפה ב-onMount מ-/api/businesses — כלומר גוגל ומנועי ה-AI
// קיבלו דף ריק בלי אף עסק. הטעינה בשרת מגישה את כל האינדקס בתוך ה-HTML,
// וכך כל עסק נסרק, נאינדקס ומקבל קישור פנימי מדף הבית.
// ============================================================

export async function load() {
	try {
		const rows = await listApprovedBusinesses();
		const businesses = rows.map(toBusiness).map((b) => ({
			id: b.documentId,
			documentId: b.documentId,
			slug: b.slug,
			name: b.name || 'ללא שם',
			phone: b.phone || '',
			category: b.category || '',
			banners: b.banners || [],
			banner: b.banner || '',
			description: b.description || '',
			discount: b.discount || '',
			salesArea: b.sales_area || '',
			address: b.address || '',
			city: b.city || '',
			website: b.website || '',
			logo: b.logo || '',
			rating: Number(b.rating || 0),
			ratingCount: Number(b.rating_count || 0),
			lat: typeof b.lat === 'number' ? b.lat : null,
			lng: typeof b.lng === 'number' ? b.lng : null
		}));
		return { businesses, loadError: null };
	} catch (/** @type {any} */ err) {
		console.error('index home load error:', err);
		// fail-soft: דף בלי רשימה עדיף על 500 — הטקסט, ה-FAQ וקישורי הרשת עדיין נסרקים
		return { businesses: [], loadError: err?.message ?? 'load failed' };
	}
}
