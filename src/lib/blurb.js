// כותרת משנה לכרטיסייה מתוך התיאור המורחב: המשפט הראשון, ובחיתוך על גבול מילה
// כשהוא ארוך. משמשת כשבעל העסק לא מילא סלוגן.
/**
 * @param {string | undefined | null} text
 * @param {number} [max]
 */
export function cardBlurb(text, max = 90) {
	const flat = String(text || '')
		.replace(/\s+/g, ' ')
		.trim();
	if (!flat) return '';
	const first = flat.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? flat;
	if (first.length <= max) return first.replace(/[.]$/, '');
	const cut = first.slice(0, max);
	const lastSpace = cut.lastIndexOf(' ');
	return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:-]+$/, '') + '…';
}
