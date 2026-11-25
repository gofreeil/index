// מחולל הודעת ווצאפ מוכנה לפרסום עסק חדש בקבוצות התנועה.
// משמש את פאנל הניהול (רשימת הממתינים, הכרטיסיות ודף עריכת עסק).
import { cardBlurb } from './blurb.js';
import { canonical } from './seo.js';

/**
 * בונה את נוסח הודעת הווצאפ לעסק חדש לפי השדות שלו.
 * מקבל גם רשומת Strapi גולמית (רשימת admin) וגם אובייקט שעבר toBusiness.
 * @param {any} b
 * @returns {string}
 */
export function buildNewBusinessWhatsapp(b) {
	const name = String(b?.name ?? '').trim();
	const slogan = String(b?.slogan || b?.extra_fields?.slogan || '').trim();
	const blurb = cardBlurb(b?.unique_content || b?.description || '');
	const fallbackCat = [b?.category, b?.subcategory].filter(Boolean).join(' — ');
	const subtitle = slogan || blurb || fallbackCat;
	const discount = String(b?.discount ?? '').trim();
	const docId = String(b?.documentId ?? b?.slug ?? '').trim();
	const bizUrl = docId ? canonical(`/business/${docId}`) : canonical('/');
	const siteUrl = canonical('/');

	const lead = subtitle
		? `יוצאים לחירות שמחים להציג בפניכם את *${name}* — ${subtitle}`
		: `יוצאים לחירות שמחים להציג בפניכם את *${name}*`;

	const lines = ['חברים יקרים ובעלי עסקים !', lead];
	if (discount) lines.push(`🎁 הטבה לחברנו: ${discount}`);
	lines.push(
		'מוזמנים להיכנס לאתר בעלי העסקים שלנו, להכיר את בעל/ת העסק וליהנות מההטבה.',
		'',
		bizUrl,
		'',
		'גם אתם בעלי עסקים? חיתמו על כללי תנועת יוצאים לחירות, ונפרסם גם את העסק שלכם בשלל המדיה החברתית שלנו!',
		`🌐 ${siteUrl}`,
		'ביחד מקדמים עסקים, מפרגנים ונהנים מהטבות!'
	);
	return lines.join('\n');
}

/**
 * קישור wa.me לפתיחת ווצאפ עם ההודעה מוכנה (האדמין בוחר קבוצה/נמען ושולח).
 * @param {string} text
 * @returns {string}
 */
export function buildWhatsappShareUrl(text) {
	return `https://wa.me/?text=${encodeURIComponent(String(text ?? ''))}`;
}
