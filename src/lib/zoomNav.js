// ─────────────────────────────────────────────────────────────
// zoomNav.js — מעבר "מצלמה" בין דפים: המסך עושה זום אל כפתור, והדף החדש
// נפתח מתוכו — כאילו נכנסים דרך הכפתור.
//
// בנוי על View Transitions API, הדפוס התקני של הדפדפן לאנימציית מעבר
// (כרום/אדג', ספארי 18+, פיירפוקס 144+), בלי ספרייה ובלי וידאו: מה שזז הוא
// צילום של המסך האמיתי של המשתמש, ולכן זה עובד אותו דבר בכל מכשיר, בכל גודל
// מסך ולכל משתמש. דפדפן בלי התמיכה, או משתמש שביקש "פחות תנועה" במערכת
// ההפעלה, מקבל ניווט רגיל — אותו יעד, בלי האנימציה.
//
// הנתונים של דף היעד נטענים מראש (preloadData) בזמן שהכפתור מודגש, כך
// שבתוך המעבר עצמו אין המתנה לרשת והאנימציה לא נתקעת באמצע.
// ─────────────────────────────────────────────────────────────
import { goto, preloadData } from '$app/navigation';

/** מסתיימת כשהמעבר האחרון נגמר. דף היעד מחכה לה לפני שהוא גולל — אחרת הגלילה הייתה רצה בתוך האנימציה. */
let current = Promise.resolve();
export const arrival = () => current;

/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** @param {HTMLElement | null} el */
function visibleRect(el) {
	if (!el) return null;
	const r = el.getBoundingClientRect();
	const inView = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
	return r.width && r.height && inView ? r : null;
}

function supported() {
	return (
		'startViewTransition' in document &&
		typeof KeyframeEffect !== 'undefined' &&
		'pseudoElement' in KeyframeEffect.prototype &&
		!matchMedia('(prefers-reduced-motion: reduce)').matches
	);
}

/**
 * הדגשת הכפתור לפני הזום — טבעת זוהרת ופעימה רכה, כדי שהעין תדע לאן נכנסים.
 * @param {HTMLElement} el
 * @returns {() => void} הסרת ההדגשה
 */
function spotlight(el) {
	const prev = el.style.boxShadow;
	el.style.boxShadow = '0 0 0 3px rgba(52,211,153,.95), 0 0 28px 8px rgba(52,211,153,.55)';
	const pulse = el.animate(
		[{ transform: 'scale(1)' }, { transform: 'scale(1.14)' }, { transform: 'scale(1)' }],
		{ duration: 900, easing: 'ease-in-out', iterations: Infinity }
	);
	return () => {
		pulse.cancel();
		el.style.boxShadow = prev;
	};
}

/**
 * האנימציה עצמה, על שני הצילומים של המעבר.
 * @param {number} x @param {number} y מרכז הכפתור על המסך
 */
function play(x, y) {
	const html = document.documentElement;
	const origin = `${x}px ${y}px`;
	const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

	// הדף הישן: המצלמה מתקרבת אל הכפתור, ואז צוללת לתוכו ונעלמת
	html.animate(
		[
			{ transformOrigin: origin, transform: 'scale(1)', opacity: 1, easing: 'cubic-bezier(.3,0,.2,1)' },
			{
				transformOrigin: origin,
				transform: 'scale(1.9)',
				opacity: 1,
				offset: 0.55,
				easing: 'cubic-bezier(.6,0,.9,.5)'
			},
			{ transformOrigin: origin, transform: 'scale(4.5)', opacity: 0 }
		],
		{ duration: 1100, fill: 'both', pseudoElement: '::view-transition-old(root)' }
	);

	// הדף החדש: נפתח מתוך הכפתור, בעיגול שמתרחב עד שהוא ממלא את המסך
	html.animate(
		[
			{ clipPath: `circle(0px at ${origin})`, transformOrigin: origin, transform: 'scale(.96)' },
			{ clipPath: `circle(${radius}px at ${origin})`, transformOrigin: origin, transform: 'scale(1)' }
		],
		{
			// התחלה איטית: רואים את העיגול נולד מתוך הכפתור, ורק אז הוא מתפרץ למסך כולו
			delay: 560,
			duration: 700,
			easing: 'cubic-bezier(.5,0,.2,1)',
			fill: 'both',
			pseudoElement: '::view-transition-new(root)'
		}
	);
}

/**
 * ניווט עם זום אל כפתור.
 * @param {string} href  דף היעד, בלי #: הוא נפתח מלמעלה, ודף היעד עצמו "נוסע" משם למקום הנכון
 * @param {Element | null} el  הכפתור שאליו עושים זום (למשל "האזור האישי" בכותרת)
 * @param {{ fallbackHref?: string, hold?: number }} [opts]
 *   fallbackHref — לאן הולכים כשאין אנימציה (למשל עם #עוגן, ישר ליעד)
 *   hold — כמה זמן לפחות ההודעה וההדגשה נשארות על המסך לפני שהוא זז
 * @returns {Promise<void>}
 */
export async function zoomGoto(href, el, { fallbackHref = href, hold = 700 } = {}) {
	const t0 = performance.now();
	const target = /** @type {HTMLElement | null} */ (el);
	if (!supported() || !visibleRect(target)) {
		await sleep(hold);
		return goto(fallbackHref);
	}

	const startUrl = location.href;
	const unspot = spotlight(/** @type {HTMLElement} */ (target));
	/** @type {Awaited<ReturnType<typeof preloadData>> | null} */
	let pre = null;
	try {
		pre = await preloadData(href);
	} catch {
		/* בלי רשת — הניווט הרגיל יטפל ויציג את השגיאה */
	}
	await sleep(Math.max(0, hold - (performance.now() - t0)));

	// המשתמש כבר עבר לדף אחר בזמן ההמתנה — לא חוטפים אותו משם
	if (location.href !== startUrl) {
		unspot();
		return;
	}

	const r = visibleRect(target);
	if (!pre || pre.type !== 'loaded' || pre.status >= 400 || !r) {
		unspot();
		return goto(fallbackHref);
	}
	const x = r.left + r.width / 2;
	const y = r.top + r.height / 2;

	// ה-crossfade המובנה של הדפדפן מבוטל רק לזמן המעבר הזה — האנימציה כאן מחליפה אותו
	const css = document.createElement('style');
	css.textContent =
		'::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}';
	document.head.append(css);

	const vt = /** @type {any} */ (document).startViewTransition(async () => {
		// הצילום של הדף הישן כבר נלקח. הכותרת משותפת לשני הדפים, אז ההדגשה
		// יורדת עכשיו — כדי שלא תופיע גם בדף החדש.
		unspot();
		await goto(href);
	});
	current = vt.finished.catch(() => {}).finally(() => css.remove());
	vt.ready.then(() => play(x, y)).catch(() => css.remove());
	return vt.updateCallbackDone;
}
