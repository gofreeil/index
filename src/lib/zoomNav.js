// ─────────────────────────────────────────────────────────────
// zoomNav.js — מעבר "מצלמה" בין דפים: מהרגע הראשון המסך מתקרב לאט אל
// כפתור, ואחרי כשנייה צולל לתוכו — והדף החדש נפתח מתוך הכפתור.
//
// בנוי על View Transitions API, הדפוס התקני של הדפדפן לאנימציית מעבר
// (כרום/אדג', ספארי 18+, פיירפוקס 144+), בלי ספרייה ובלי וידאו: מה שזז הוא
// צילום של המסך האמיתי של המשתמש, ולכן זה עובד אותו דבר בכל מכשיר ובכל גודל
// מסך. דפדפן בלי התמיכה, או משתמש שביקש "פחות תנועה" במערכת ההפעלה, מקבל
// ניווט רגיל — אותו יעד, בלי האנימציה.
//
// בלי רגע מת: המעבר נפתח מיד עם עדכון ריק — הדפדפן מצלם את המסך, והצילום
// מתחיל להתקרב. הנתונים של דף היעד נטענים בזמן הזום, והניווט עצמו קורה
// "מאחורי הקלעים" — הדף החדש חי מתחת לצילום, מוסתר, עד רגע הכניסה.
// ─────────────────────────────────────────────────────────────
import { goto, preloadData } from '$app/navigation';

/** מסתיימת כשהמעבר האחרון נגמר. דף היעד מחכה לה לפני שהוא גולל — אחרת הגלילה הייתה רצה בתוך האנימציה. */
let current = Promise.resolve();
export const arrival = () => current;

const OLD = '::view-transition-old(root)';
const NEW = '::view-transition-new(root)';
/** עד כמה מתקרבים בשלב האיטי (אם הטעינה מתארכת — ממשיכים לזחול לכאן). */
const APPROACH_MAX = 1.8;

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
 * טבעת זוהרת סביב הכפתור ובועה קטנה מתחתיו ("לאזור האישי שלך"). שתיהן
 * נכנסות לצילום שמתקרב — הבועה יושבת ליד מרכז הזום, ולכן נשארת על המסך
 * וגדלה איתו במקום לברוח החוצה — ויורדות מהדף החי מיד אחרי הצילום.
 * @param {HTMLElement} el @param {DOMRect} rect @param {string} label
 * @returns {() => void} הסרה (בטוחה לקריאה כפולה)
 */
function mark(el, rect, label) {
	const prevShadow = el.style.boxShadow;
	el.style.boxShadow = '0 0 0 3px rgba(52,211,153,.95), 0 0 28px 8px rgba(52,211,153,.55)';

	/** @type {HTMLDivElement | null} */
	let tip = null;
	if (label) {
		const green = '#059669';
		tip = document.createElement('div');
		tip.setAttribute('aria-hidden', 'true');
		tip.textContent = label;
		Object.assign(tip.style, {
			position: 'fixed',
			zIndex: '100',
			top: `${rect.bottom + 12}px`,
			left: '0px',
			padding: '7px 12px',
			borderRadius: '10px',
			background: green,
			color: '#fff',
			fontSize: '14px',
			fontWeight: '700',
			lineHeight: '1.3',
			whiteSpace: 'nowrap',
			boxShadow: '0 10px 30px -8px rgba(0,0,0,.6)',
			direction: getComputedStyle(document.documentElement).direction,
			pointerEvents: 'none'
		});
		const arrow = document.createElement('span');
		Object.assign(arrow.style, {
			position: 'absolute',
			top: '-5px',
			width: '12px',
			height: '12px',
			borderRadius: '2px',
			background: green,
			transform: 'rotate(45deg)'
		});
		tip.append(arrow);
		document.body.append(tip);
		// ממורכזת מתחת לכפתור, ולא חורגת מקצה המסך (בנייד הכפתור צמוד לפינה)
		const cx = rect.left + rect.width / 2;
		const left = Math.min(Math.max(8, cx - tip.offsetWidth / 2), innerWidth - tip.offsetWidth - 8);
		tip.style.left = `${left}px`;
		arrow.style.left = `${cx - left - 6}px`;
	}

	let done = false;
	return () => {
		if (done) return;
		done = true;
		el.style.boxShadow = prevShadow;
		tip?.remove();
	};
}

/**
 * ניווט עם זום אל כפתור.
 * @param {string} href  דף היעד, בלי #: הוא נפתח מלמעלה, ודף היעד עצמו "נוסע" משם למקום הנכון
 * @param {Element | null} el  הכפתור שאליו מתקרבים (למשל "האזור האישי" בכותרת)
 * @param {{ fallbackHref?: string, label?: string, enterAfter?: number }} [opts]
 *   fallbackHref — לאן הולכים כשאין אנימציה (למשל עם #עוגן, ישר ליעד)
 *   label — טקסט הבועה שליד הכפתור
 *   enterAfter — אחרי כמה זמן מתחילת הזום נכנסים פנימה (אם הדף כבר מוכן)
 * @returns {Promise<void>}
 */
export async function zoomGoto(href, el, { fallbackHref = href, label = '', enterAfter = 1000 } = {}) {
	const target = /** @type {HTMLElement | null} */ (el);
	const rect = supported() ? visibleRect(target) : null;
	if (!target || !rect) {
		await sleep(700); // ההודעה נשארת רגע על המסך, ואז ניווט רגיל
		return goto(fallbackHref);
	}

	const t0 = performance.now();
	const startUrl = location.href;
	const html = document.documentElement;
	const x = rect.left + rect.width / 2;
	const y = rect.top + rect.height / 2;
	const origin = `${x}px ${y}px`;

	// הנתונים של דף היעד נטענים מעכשיו — במקביל לזום, לא לפניו
	const loading = preloadData(href).catch(() => null);

	const unmark = mark(target, rect, label);
	// ה-crossfade המובנה של הדפדפן מבוטל רק לזמן המעבר הזה — האנימציה כאן מחליפה אותו
	const css = document.createElement('style');
	css.textContent = `${OLD},${NEW}{animation:none;mix-blend-mode:normal}`;
	document.head.append(css);

	// עדכון ריק: הדפדפן מצלם את המסך, והטבעת והבועה יורדות מהדף החי
	const vt = /** @type {any} */ (document).startViewTransition(() => unmark());
	current = vt.finished.catch(() => {}).finally(() => css.remove());

	/** @type {Animation | null} */
	let approach = null;
	/** @type {Animation | null} */
	let veil = null;
	try {
		await vt.ready;
		// 1) מהרגע הראשון: התקרבות איטית אל הכפתור
		approach = html.animate(
			[
				{ transformOrigin: origin, transform: 'scale(1)' },
				{ transformOrigin: origin, transform: `scale(${APPROACH_MAX})` }
			],
			{ duration: 4500, easing: 'cubic-bezier(.25,.5,.35,1)', fill: 'both', pseudoElement: OLD }
		);
		// הדף החי (שעוד מעט יתחלף לדף היעד) מוסתר מתחת לצילום עד רגע הכניסה
		veil = html.animate([{ opacity: 0 }, { opacity: 0 }], {
			duration: 10_000,
			fill: 'both',
			pseudoElement: NEW
		});
	} catch {
		/* המעבר דולג (למשל לשונית מוסתרת) — ממשיכים בניווט רגיל */
	}

	const stop = () => {
		unmark();
		approach?.cancel();
		veil?.cancel();
	};

	const pre = await loading;
	if (location.href !== startUrl) return stop(); // המשתמש כבר עבר לדף אחר — לא חוטפים אותו
	if (!approach || !veil || !pre || pre.type !== 'loaded' || pre.status >= 400) {
		stop();
		return goto(fallbackHref);
	}

	// הניווט קורה מתחת לצילום: הדף החדש נבנה ונגלל לראשו בזמן שהזום ממשיך
	await goto(href);
	await sleep(Math.max(0, enterAfter - (performance.now() - t0)));

	// 2) נכנסים: המצלמה צוללת לתוך הכפתור, והדף החדש נפתח מתוכו בעיגול מתרחב.
	// הצלילה ממשיכה מהקנה-מידה שאליו הזום האיטי הגיע — בלי קפיצה.
	const p = approach.effect?.getComputedTiming().progress ?? 1;
	const s = 1 + (APPROACH_MAX - 1) * p;
	const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
	approach.cancel();
	veil.cancel();
	html.animate(
		[
			{ transformOrigin: origin, transform: `scale(${s})`, opacity: 1 },
			{ transformOrigin: origin, transform: `scale(${s * 2.6})`, opacity: 0 }
		],
		{ duration: 550, easing: 'cubic-bezier(.55,0,.8,.3)', fill: 'both', pseudoElement: OLD }
	);
	html.animate(
		[{ clipPath: `circle(0px at ${origin})` }, { clipPath: `circle(${radius}px at ${origin})` }],
		{ duration: 600, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'both', pseudoElement: NEW }
	);
}
