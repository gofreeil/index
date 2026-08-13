import { listApprovedBusinesses } from '$lib/server/strapi.js';
import { getCategorySettings } from '$lib/server/categoryStore.js';
import { toBusiness } from '$lib/businessShape.js';
import {
	resolveCategory,
	categoryDisplayResolver,
	categoryRailMeta,
	retiredLabelSet
} from '$lib/categories.js';

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
		// קטגוריה שנמחקה במסך הניהול אינה קיימת יותר: היא לא צדה כרטיסיות
		// בסיווג האוטומטי, וכרטיסייה שנשמרה איתה מסווגת מחדש — כך לא נשאר
		// במסילה אריח של תחום מחוק
		const retired = retiredLabelSet(catSettings);
		const businesses = rows.map(toBusiness).map((b) => ({
			id: b.documentId,
			documentId: b.documentId,
			slug: b.slug,
			name: b.name || 'ללא שם',
			phone: b.phone || '',
			category: displayName(resolveCategory(b, retired)),
			// "תת-קטגוריה / פירוט" — שם המקצוע במילים של העסק עצמו. הוא מזין
			// את החיפוש ואת ההצעות הקרובות ($lib/searchSuggest)
			subcategory: b.subcategory || '',
			// התגיות שבעל העסק רשם — המילים שבהן יחפשו אותו. הן נבדקות
			// בחיפוש כמעט כמו שם העסק (ראו matchesSearch ו-searchSuggest).
			tags: b.tags || [],
			banners: b.banners || [],
			banner: b.banner || '',
			// מיקום וזום של הלוגו והתמונה באריח (ראו mediaFit.js)
			logo_fit: b.logo_fit,
			banner_fits: b.banner_fits,
			// איזו מהתמונות היא הראשית — הבאנר של האריח (ראו mediaFit.js)
			main_index: b.main_index,
			// הטקסט של העסק — "תיאור מורחב" (unique_content). description הוא שריד
			// "תיאור קצר" שנמחק מהטופס, ונשאר כנפילה אחורה לכרטיסיות שטרם מוזגו.
			// משמש את החיפוש בדף הבית.
			description: b.unique_content || b.description || '',
			// הסלוגן מוצג בכרטיסייה עצמה, ולא רק בעמוד העסק
			slogan: b.slogan || '',
			discount: b.discount || '',
			salesArea: b.sales_area || '',
			address: b.address || '',
			city: b.city || '',
			// מקומות נוספים — המפה מציירת עיגול לכל אחד (ראו serviceArea.js)
			branches: b.branches || [],
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
