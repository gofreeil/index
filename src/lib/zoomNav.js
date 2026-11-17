// ─────────────────────────────────────────────────────────────
// zoomNav.js — מעבר "מצלמה" בין דפים: מהרגע הראשון המסך מתקרב אל כפתור,
// ואחרי כשנייה צולל לתוכו — והדף החדש נפתח מתוך הכפתור.
//
// בנוי על View Transitions API, הדפוס התקני של הדפדפן לאנימציית מעבר
// (כרום/אדג', ספארי 18+, פיירפוקס 144+), בלי ספרייה ובלי וידאו: מה שזז הוא
// צילום של המסך האמיתי של המשתמש, ולכן זה עובד אותו דבר בכל מכשיר ובכל גודל
// מסך. דפדפן בלי התמיכה, או משתמש שביקש "פחות תנועה" במערכת ההפעלה, מקבל
// ניווט רגיל — אותו יעד, בלי האנימציה.
//
// בלי רגע מת:
//   • warm() טוען את דף היעד מראש, עוד לפני הלחיצה (השיתוף החכם קורא לו
//     ברגע השליחה) — כך שבלחיצה עצמה הנתונים כבר מוכנים.
//   • המעבר נפתח מיד בלחיצה: הדפדפן מצלם את המסך והצילום מתחיל להתקרב. אם
//     הנתונים עוד לא הגיעו, הזום ממשיך לנוע וגלגל הטעינה שבבועה מסתובב —
//     המשתמש תמיד רואה שמשהו קורה. הניווט עצמו קורה מתחת לצילום, והדף
//     החדש מוסתר עד רגע הכניסה.
// ─────────────────────────────────────────────────────────────
import { browser } from '$app/environment';
import { goto, preloadData } from '$app/navigation';

/** מסתיימת כשהמעבר האחרון נגמר. דף היעד מחכה לה לפני שהוא גולל — אחרת הגלילה הייתה רצה בתוך האנימציה. */
let current = Promise.resolve();
export const arrival = () => current;

const OLD = '::view-transition-old(root)';
const NEW = '::view-transition-new(root)';
/** הבועה שליד הכפתור היא שכבה נפרדת במעבר — לא חלק מהצילום הקפוא */
const TIP = 'zoom-tip';
const TIP_PAIR = `::view-transition-image-pair(${TIP})`;
// ההתקרבות לא נעצרת: מהירה בהתחלה (1.37× אחרי שנייה) ומאטה בהדרגה, אבל
// ממשיכה לזחול גם אם הטעינה מתארכת — המסך אף פעם לא נראה תקוע.
const APPROACH_MAX = 2.4;
const APPROACH_MS = 8000;
const APPROACH_EASE = 'cubic-bezier(.2,.45,.5,1)';

/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * טעינה מוקדמת של דף היעד (הקוד והנתונים), כדי שהמעבר אליו לא יחכה לשרת.
 * בטוח לקריאה חוזרת: כל עוד הטעינה הקודמת באותו דף שמורה — לא נשלחת בקשה חדשה.
 * @param {string} href
 */
export function warm(href) {
	if (browser) preloadData(href).catch(() => {});
}

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
 * טבעת זוהרת סביב הכפתור — נכנסת לצילום שמתקרב, ויורדת מהדף החי מיד אחריו.
 * @param {HTMLElement} el
 * @returns {() => void}
 */
function ring(el) {
	const prev = el.style.boxShadow;
	el.style.boxShadow = '0 0 0 3px rgba(52,211,153,.95), 0 0 28px 8px rgba(52,211,153,.55)';
	let done = false;
	return () => {
		if (done) return;
		done = true;
		el.style.boxShadow = prev;
	};
}

/**
 * הבועה מתחת לכפתור: גלגל טעינה + "לאזור האישי שלך". view-transition-name
 * הופך אותה לשכבה נפרדת במעבר — לכן היא חיה (הגלגל מסתובב כל זמן ההמתנה)
 * וחדה (לא מוגדלת יחד עם הצילום). היא חייבת להישאר בדף עד סוף המעבר:
 * הסרה של אלמנט כזה באמצע מבטלת את המעבר.
 * @param {DOMRect} rect @param {string} label
 */
function bubble(rect, label) {
	const green = '#059669';
	const tip = document.createElement('div');
	tip.setAttribute('aria-hidden', 'true');
	Object.assign(tip.style, {
		position: 'fixed',
		zIndex: '100',
		top: `${rect.bottom + 12}px`,
		left: '0px',
		display: 'flex',
		alignItems: 'center',
		gap: '8px',
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
	tip.style.setProperty('view-transition-name', TIP);

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
	const spinner = document.createElement('span');
	Object.assign(spinner.style, {
		width: '14px',
		height: '14px',
		flex: 'none',
		borderRadius: '50%',
		border: '2px solid rgba(255,255,255,.35)',
		borderTopColor: '#fff'
	});
	const text = document.createElement('span');
	text.textContent = label;
	tip.append(arrow, spinner, text);
	document.body.append(tip);

	// ממורכזת מתחת לכפתור, ולא חורגת מקצה המסך (בנייד הכפתור צמוד לפינה)
	const cx = rect.left + rect.width / 2;
	const left = Math.min(Math.max(8, cx - tip.offsetWidth / 2), innerWidth - tip.offsetWidth - 8);
	tip.style.left = `${left}px`;
	arrow.style.left = `${cx - left - 6}px`;
	spinner.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
		duration: 800,
		iterations: Infinity
	});
	return tip;
}

/**
 * ניווט עם זום אל כפתור.
 * @param {string} href  דף היעד, בלי #: הוא נפתח מלמעלה, ודף היעד עצמו "נוסע" משם למקום הנכון
 * @param {Element | null} el  הכפתור שאליו מתקרבים (למשל "האזור האישי" בכותרת)
 * @param {{ fallbackHref?: string, label?: string, enterAfter?: number }} [opts]
 *   fallbackHref — לאן הולכים כשאין אנימציה (למשל עם #עוגן, ישר ליעד)
 *   label — טקסט הבועה שליד הכפתור
 *   enterAfter — זמן מינימלי מתחילת הזום עד הכניסה פנימה. ברירת המחדל 0:
 *   נכנסים ברגע שהדף מוכן — המטרה מהירות, לא השהיה
 * @returns {Promise<void>}
 */
export async function zoomGoto(href, el, { fallbackHref = href, label = '', enterAfter = 0 } = {}) {
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

	// בדרך כלל כבר נטען מראש (warm); אם לא — נטען מעכשיו, במקביל לזום
	const loading = preloadData(href).catch(() => null);

	const unring = ring(target);
	const tip = label ? bubble(rect, label) : null;
	// ה-crossfade המובנה של הדפדפן מבוטל רק לזמן המעבר הזה — האנימציה כאן מחליפה אותו
	const css = document.createElement('style');
	css.textContent =
		`${OLD},${NEW}{animation:none;mix-blend-mode:normal}` +
		`::view-transition-group(${TIP}){animation:none}` +
		`::view-transition-old(${TIP}){animation:none;opacity:0}` +
		`::view-transition-new(${TIP}){animation:none;mix-blend-mode:normal}`;
	document.head.append(css);

	let cleaned = false;
	const cleanup = () => {
		if (cleaned) return;
		cleaned = true;
		unring();
		tip?.remove();
		css.remove();
	};

	// עדכון ריק: הדפדפן מצלם את המסך, והטבעת יורדת מהדף החי
	const vt = /** @type {any} */ (document).startViewTransition(() => unring());
	current = vt.finished.catch(() => {}).finally(cleanup);

	/** @type {Animation | null} */
	let approach = null;
	/** @type {Animation | null} */
	let veil = null;
	/** @type {Animation | null} */
	let follow = null;
	const approachTiming = {
		duration: APPROACH_MS,
		easing: APPROACH_EASE,
		fill: /** @type {FillMode} */ ('both')
	};
	try {
		await vt.ready;
		// 1) מהרגע הראשון: התקרבות אל הכפתור
		approach = html.animate(
			[
				{ transformOrigin: origin, transform: 'scale(1)' },
				{ transformOrigin: origin, transform: `scale(${APPROACH_MAX})` }
			],
			{ ...approachTiming, pseudoElement: OLD }
		);
		// הדף החי (שעוד מעט יתחלף לדף היעד) מוסתר מתחת לצילום עד רגע הכניסה
		veil = html.animate([{ opacity: 0 }, { opacity: 0 }], {
			duration: 15_000,
			fill: 'both',
			pseudoElement: NEW
		});
		// הבועה צמודה לתחתית הכפתור שגדל — יורדת יחד איתו, בלי להתנפח
		if (tip) {
			follow = html.animate(
				[
					{ transform: 'translateY(0px)' },
					{ transform: `translateY(${((APPROACH_MAX - 1) * rect.height) / 2}px)` }
				],
				{ ...approachTiming, pseudoElement: TIP_PAIR }
			);
		}
	} catch {
		/* המעבר דולג (למשל לשונית מוסתרת) — ממשיכים בניווט רגיל */
	}

	const stop = () => {
		approach?.cancel();
		veil?.cancel();
		follow?.cancel();
		cleanup();
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
	// הצלילה ממשיכה מהקנה-מידה שאליו ההתקרבות הגיעה — בלי קפיצה.
	const p = approach.effect?.getComputedTiming().progress ?? 1;
	const s = 1 + (APPROACH_MAX - 1) * p;
	const ty = ((s - 1) * rect.height) / 2;
	const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
	approach.cancel();
	veil.cancel();
	follow?.cancel();
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
	if (tip) {
		const fade = html.animate(
			[
				{ opacity: 1, transform: `translateY(${ty}px)` },
				{ opacity: 0, transform: `translateY(${ty}px)` }
			],
			{ duration: 200, fill: 'both', pseudoElement: TIP_PAIR }
		);
		// אחרי שדעכה — מוסתרת גם בדף החי (בלי להוציא אותה מהדף, שזה היה מבטל את
		// המעבר), כדי שלא תהבהב לרגע כשהמעבר נגמר ולפני שהיא מוסרת
		fade.finished.then(() => (tip.style.visibility = 'hidden')).catch(() => {});
	}
}
