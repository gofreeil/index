// ============================================================
// inlineImage.js — תמונות ששמורות כ-data:...;base64 בתוך רשומת Strapi
// פורט מ-community/my_new_project/src/lib/server/inlineImage.ts.
//
// הטבעת התמונות האלה בתוך הנתונים של כל דף היא מה ששרף את מכסת ה-Fast
// Origin Transfer של Vercel: אותם בייטים יצאו מהשרת מחדש בכל צפייה, בלי
// שום אפשרות לקאש (נמדד כאן: 3,074KB מתוך 3,574KB בדף — 86% — וכל תמונה
// פעמיים, ב-HTML ובנתוני ההידרציה). במקום זה מגישים אותן מנתיב ייעודי
// עם קאש ארוך.
//
// שים לב: נתיב שמגיש תמונה כזו חייב לעקוף את ה-handle ב-hooks.server —
// תשובה שנושאת Set-Cookie לעולם לא נשמרת בקאש הקצה של Vercel, וכל בקשה
// חוזרת ל-origin (ראה PUBLIC_IMAGE_PATH שם).
// ============================================================

/**
 * חותם תוכן קצר, לשימוש כ-?v= בכתובת התמונה: כך הכתובת ייחודית לתמונה
 * הזו, ומתחלפת ברגע שהתמונה מוחלפת — מה שמאפשר קאש immutable בלי חשש
 * להצגת תמונה ישנה.
 *
 * זול בכוונה — אורך + ראש ה-base64 (שמקודד את כותרת הקובץ ואת הפיקסלים
 * הראשונים), בלי לגבב מגה-בייטים בכל מילוי cache. תמונה מוחלפת משנה
 * כמעט תמיד גם את האורך וגם את הכותרת.
 * @param {...string} images
 * @returns {string}
 */
export function imageStamp(...images) {
	let h = 0;
	for (const img of images) {
		const probe = `${img.length}:${img.slice(28, 60)}`;
		for (let i = 0; i < probe.length; i++) {
			h = (Math.imul(h, 31) + probe.charCodeAt(i)) | 0;
		}
	}
	return (h >>> 0).toString(36);
}

/**
 * מפרק data:image/...;base64 לבייטים. null לכל ערך שאינו data URI של תמונה.
 *
 * הסינון ל-image/ בלבד אינו קוסמטי: הטיפוס נלקח מהנתונים ונשלח ככותרת
 * content-type, והתמונה מוגשת מכתובת שאפשר *לנווט* אליה (בשונה מ-data URI
 * שיושב בתוך <img> ואינו ניתן לניווט). בלי הסינון, פרסומת שהוזרק לשדה
 * התמונה שלה data:text/html הייתה הופכת למסמך HTML שרץ בדומיין של האתר.
 * @param {string|undefined|null} raw
 * @returns {{ mime: string, bytes: ArrayBuffer }|null}
 */
export function decodeDataImage(raw) {
	const m = /^data:(image\/[\w+.-]+);base64,(.*)$/s.exec(raw ?? '');
	if (!m) return null;
	try {
		const buf = Buffer.from(m[2], 'base64');
		// slice ולא buf.buffer עצמו: Buffer יושב על מאגר משותף של Node, והחזרתו
		// כמות שהיא הייתה חושפת בייטים של הקצאות אחרות שסביבו
		return {
			mime: m[1],
			bytes: /** @type {ArrayBuffer} */ (
				buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
			)
		};
	} catch {
		return null;
	}
}

/**
 * תשובת תמונה שאפשר לשמור בקאש לנצח — הכתובת עצמה נושאת חותם תוכן,
 * ולכן החלפת התמונה מייצרת כתובת אחרת ולא מצריכה פקיעה.
 * @param {{ mime: string, bytes: ArrayBuffer }} img
 * @returns {Response}
 */
export function immutableImageResponse(img) {
	return new Response(img.bytes, {
		headers: {
			'content-type': img.mime,
			'content-length': String(img.bytes.byteLength),
			'cache-control': 'public, max-age=31536000, s-maxage=31536000, immutable',
			// nosniff: הדפדפן לא ינחש טיפוס אחר מהתוכן.
			// CSP+sandbox: מנטרל הרצת סקריפט גם ב-SVG, שהוא תמונה לכל דבר
			// אבל יודע להריץ קוד כשמנווטים אליו ישירות.
			'x-content-type-options': 'nosniff',
			'content-security-policy': "default-src 'none'; sandbox"
		}
	});
}
