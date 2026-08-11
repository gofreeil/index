// ============================================================
// img.js — הגשת תמונה במידה שבה היא באמת מוצגת.
//
// תמונות הקטגוריות והכרטיסיות נשמרות ב-Strapi בגודל המקורי (עד 3MB לכל
// אחת), ומוצגות במשבצת של ~120px. כלומר דף הבית הוריד עשרות מגה-בייט כדי
// לצייר אריחים בגודל בול — וזו הסיבה שהמסילה נפתחה לאט. כאן הכתובת עוברת
// דרך ממטב התמונות של Vercel (‎/_vercel/image‎): הוא חותך לרוחב המבוקש,
// ממיר ל-avif/webp לפי מה שהדפדפן תומך, ושומר את התוצאה במטמון ה-CDN —
// אותה תמונה בדיוק, בערך ב-2% מהמשקל.
//
// מה עובר כמו שהוא, בלי ממטב:
//   • דומיין זר — logo_url חיצוני שהוקלד ידנית. הממטב מקבל רק דומיינים
//     שהוצהרו ב-svelte.config.js, וכל השאר היה חוזר כשגיאה.
//   • SVG — הממטב דוחה אותו (dangerouslyAllowSVG כבוי), והוא קל ממילא.
//   • פיתוח מקומי — ‎/_vercel/image‎ קיים רק בפריסה.
//
// ובכל זאת, אם הממטב נופל (כבוי בפרויקט, מקור גדול מדי) — ‎use:imgFallback‎
// מחזיר את התמונה לכתובת המקורית. במקרה הגרוע חוזרים למצב הקודם, לא
// למשבצת ריקה.
// ============================================================

import { dev } from '$app/environment';
import { MEDIA_HOST, IMG_WIDTHS } from './mediaConfig.js';

export { IMG_WIDTHS };

/** @param {string} url */
function optimizable(url) {
	if (dev || !url || !url.startsWith('http')) return false;
	try {
		const u = new URL(url);
		return u.hostname === MEDIA_HOST && !u.pathname.toLowerCase().endsWith('.svg');
	} catch {
		return false; // כתובת פגומה — שיטפל בה הדפדפן, לא הממטב
	}
}

/** הרוחב החוקי הקרוב ביותר כלפי מעלה @param {number} w */
const snap = (/** @type {number} */ w) =>
	IMG_WIDTHS.find((s) => s >= w) ?? IMG_WIDTHS[IMG_WIDTHS.length - 1];

/**
 * כתובת התמונה ברוחב המבוקש (בפיקסלי CSS × צפיפות המסך).
 * @param {string} url @param {number} width
 */
export function imgUrl(url, width) {
	if (!optimizable(url)) return url;
	return `/_vercel/image?url=${encodeURIComponent(url)}&w=${snap(width)}&q=75`;
}

/**
 * srcset ברוחבים אחדים, כדי שמסך רגיל לא יוריד את הגרסה של מסך Retina.
 * מחזיר undefined כשאין ממטב — ואז הדפדפן נשאר עם src בלבד.
 * @param {string} url @param {number[]} widths
 */
export function imgSrcSet(url, widths) {
	if (!optimizable(url)) return undefined;
	const seen = new Set();
	const out = [];
	for (const w of widths) {
		const s = snap(w);
		if (seen.has(s)) continue;
		seen.add(s);
		out.push(`${imgUrl(url, s)} ${s}w`);
	}
	return out.join(', ');
}

/**
 * רשת ביטחון: כישלון טעינה דרך הממטב → ניסיון אחד בכתובת המקורית.
 * @param {HTMLImageElement} node @param {string} original
 */
export function imgFallback(node, original) {
	let src = original;
	let tried = false;

	function onError() {
		// node.src מוחלט, src עשוי להיות יחסי — ההשוואה היא מול הכתובת שכבר נוסתה
		if (tried || !src || node.src === new URL(src, location.href).href) return;
		tried = true;
		node.removeAttribute('srcset'); // אחרת הדפדפן יבחר שוב מהממטב
		node.src = src;
	}

	node.addEventListener('error', onError);
	return {
		update(/** @type {string} */ next) {
			src = next;
			tried = false; // תמונה אחרת — מגיע לה ניסיון משלה
		},
		destroy: () => node.removeEventListener('error', onError)
	};
}
