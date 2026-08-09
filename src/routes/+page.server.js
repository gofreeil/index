import { listApprovedBusinesses } from '$lib/server/strapi.js';
import { getCategorySettings } from '$lib/server/categoryStore.js';
import { toBusiness } from '$lib/businessShape.js';
import { resolveCategory, categoryDisplayResolver, categoryRailMeta } from '$lib/categories.js';

// ============================================================
// טעינת האינדקס בצד-השרת (SSR).
// עד כאן הרשימה נשלפה ב-onMount מ-/api/businesses — כלומר גוגל ומנועי ה-AI
// קיבלו דף ריק בלי אף עסק. הטעינה בשרת מגישה את כל האינדקס בתוך ה-HTML,
// וכך כל עסק נסרק, נאינדקס ומקבל קישור פנימי מדף הבית.
//
// התחום נקבע כאן ולא בדפדפן (resolveCategory): 80 מתוך 92 הכרטיסיות הגיעו
// בלי קטגוריה או עם "אחר", והסיווג האוטומטי מחזיר אותן לתחום האמיתי שלהן
// כבר ב-HTML הראשון — כך שגם הסינון, גם מסילת התחומים וגם הסורק רואים
// את אותה טקסונומיה.
// ============================================================

export async function load() {
	try {
		// דריסות הסופר-אדמין (שם/אייקון/תמונה/סדר) חלות על התצוגה בלבד —
		// המאגר ממשיך להחזיק את התוויות הקנוניות
		const [rows, catSettings] = await Promise.all([
			listApprovedBusinesses(),
			getCategorySettings()
		]);
		const displayName = categoryDisplayResolver(catSettings);
		const businesses = rows.map(toBusiness).map((b) => ({
			id: b.documentId,
			documentId: b.documentId,
			slug: b.slug,
			name: b.name || 'ללא שם',
			phone: b.phone || '',
			category: displayName(resolveCategory(b)),
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
		return { businesses, catRail: categoryRailMeta(catSettings), loadError: null };
	} catch (/** @type {any} */ err) {
		console.error('index home load error:', err);
		// fail-soft: דף בלי רשימה עדיף על 500 — הטקסט, ה-FAQ וקישורי הרשת עדיין נסרקים
		return {
			businesses: [],
			catRail: categoryRailMeta(null),
			loadError: err?.message ?? 'load failed'
		};
	}
}
