<script>
	import { untrack } from 'svelte';
	import { adImgFit, parseAdImageFit } from '$lib/adImageFit';
	import { imgUrl, imgSrcSet, imgFallback } from '$lib/img.js';

	// ============================================================
	// מסילת התחומים — יובאה מ"גמ"חי ישראל" (national-gemach) והותאמה כאן
	// לפלטה של האינדקס (אפור-כחול על גרפיט, במקום כחול-זהב).
	//
	// למה מסילה ולא <select>: תפריט נפתח מסתיר את התחומים עד שנוגעים בו, ולכן
	// אף אחד לא ידע מה בכלל יש באתר. המסילה מציגה את התחומים המובילים מיד,
	// עם מונה עסקים על כל אריח, והשאר נחשפים בגרירה של השורה.
	//
	// גלישה ולא הסתרה — כל אריח נשאר ב-DOM, בסדר ה-Tab ובעץ הנגישות; מי
	// שמנווט במקלדת עובר בין האריחים בחצים, ב-Home וב-End.
	// ============================================================

	/** @typedef {{ key: string, label: string, icon: string, image?: string, imageFit?: { x: number, y: number, z: number }, count: number }} RailCat */

	/** @type {{ categories: RailCat[], selected?: string, onselect?: (key: string) => void, title?: string }} */
	let { categories, selected = '', onselect, title = 'סינון מהיר לפי תחום' } = $props();

	const LOCK_PX = 10; // דד-זון לנעילת ציר הגרירה
	const TAP_PX = 15; // מעל זה זו גרירה ולא הקשה
	const GAP_PX = 12; // חייב להתאים ל-gap של .cat-rail (0.75rem)
	const CLICK_GUARD_MS = 120;
	const CLICK_EXPIRE_MS = 400;

	/** @type {HTMLUListElement | null} */
	let railEl = $state(null);
	/** @type {HTMLDivElement | null} */
	let trackEl = $state(null);
	let rtl = $state(true); // ברירת מחדל נכונה כבר ב-SSR (הדף כולו rtl)
	let dragging = $state(false);
	let hinted = $state(false);
	let overflowing = $state(false);
	let atStart = $state(true);
	let atEnd = $state(false);
	let progress = $state(0); // 0..1
	let thumbRatio = $state(1); // clientWidth / scrollWidth
	let hiddenCount = $state(0); // כמה תחומים עוד מחכים קדימה
	let scrubbing = $state(false); // גרירת ידית הסקראבר פעילה

	/* רוחבי הדהייה בשני הקצוות, בפיקסלים. נגזרים ממרחק הגלילה ולא מ-atStart/atEnd:
	   מיתוג בינארי מקפיץ מסכה של 32px בפריים אחד — פופ שנראה כגליץ'. */
	const FADE_PX = 32; // = 2rem, וגם scroll-padding-inline של המסילה
	let fadeLeadPx = $state(0); // הקצה שממנו האריחים יוצאים (ימין ב-RTL)
	let fadeTailPx = $state(0); // הקצה שממנו הם נכנסים

	// לא-ריאקטיביים: לא מוצגים, ולכן אין טעם ב-$state
	let pointerId = -1;
	let thumbPointerId = -1,
		thumbGrab = 0; // ידית הסקראבר: מזהה מצביע + היסט האחיזה בתוך הידית
	let isTouch = false;
	/** @type {'h' | 'v' | null} */
	let axisLock = null;
	let startX = 0,
		startY = 0,
		startScroll = 0,
		maxMove = 0;
	let suppressClick = false,
		dragEndedAt = 0;
	let rafId = 0,
		nudged = false,
		tileStep = 0;
	let gapPx = GAP_PX,
		spacerPx = 32; // נמדדים מה-DOM; הקבועים הם רק ברירת מחדל ל-SSR
	let padStartPx = 8; // padding-inline-start של המסילה (0.5rem)
	let reduceMotion = false; // נקרא פעם אחת; הדומינו כבוי כשמבקשים פחות תנועה

	const prefersReduce = () =>
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/** קריאה יחידה של גאומטריית הגלילה — אדישה לסימן של scrollLeft ב-RTL */
	function readScroll() {
		const el = railEl;
		if (!el) return;
		const max = el.scrollWidth - el.clientWidth;
		const pos = Math.min(Math.abs(el.scrollLeft), Math.max(max, 0));
		// משתנה מקומי ולא קריאה חוזרת של atEnd: קריאת $state שנכתב זה עתה הייתה
		// הופכת את ה-$effect שקורא לפונקציה לתלוי בו, ומרכיבה מחדש את ה-ResizeObserver
		const isEnd = max <= 4 || pos >= max - 2;

		overflowing = max > 4;
		atStart = pos <= 2; // אפסילון נגד עיגול בזום/hi-dpi
		atEnd = isEnd;
		progress = max > 0 ? pos / max : 0;
		// עיגול לפיקסל: קצה הגרדיאנט רך, וחישוב מסכה חדש בכל שבריר פיקסל הוא בזבוז
		fadeLeadPx = Math.round(Math.min(FADE_PX, Math.max(0, pos)));
		fadeTailPx = Math.round(Math.min(FADE_PX, Math.max(0, max - pos)));
		thumbRatio = el.scrollWidth > 0 ? Math.min(1, el.clientWidth / el.scrollWidth) : 1;
		// גלגלת/מקלדת/סרגל — תזוזה אמיתית מכבה את הרמז. הסף גבוה מ-36px של הנדנוד
		// האוטומטי, כדי שהרמז לא יכבה את עצמו
		if (pos > 48) hinted = true;

		// כל האריחים ברוחב זהה, ולכן די במדידת הראשון. offsetWidth ולא
		// getBoundingClientRect: הראשון עשוי להיות מסובב בדומינו, ותיבת ה-rect
		// שלו מצטמקת עם הסיבוב — offsetWidth הוא מידת הפריסה האמיתית
		const first = /** @type {HTMLElement | null} */ (el.querySelector('[data-tile]'));
		if (first) tileStep = first.offsetWidth + gapPx;
		const spacer = /** @type {HTMLElement | null} */ (el.querySelector('[data-spacer]'));
		if (spacer) spacerPx = spacer.offsetWidth;

		// ספירה לפי מרחק הגלילה שנותר, לא לפי אינדקסים: אחרת המונה מגיע ל-0
		// בזמן שהאריח האחרון עדיין חתוך, והגלולה מציגה "עוד 0"
		if (tileStep > 0 && !isEnd) {
			const remaining = max - pos - spacerPx - gapPx;
			hiddenCount = Math.max(0, Math.ceil(remaining / tileStep));
		} else {
			hiddenCount = 0;
		}

		paintDepth(pos);
	}

	/* ── דומינו תלת-מימדי ────────────────────────────────────────────────
	   אריח שמתקרב לקצה-ההובלה (ימין ב-RTL) נסוג אחורה והצידה, כמו אבן דומינו
	   שנוטה ליפול, וכל אריח גורר את זה שאחריו. ה-JS כותב רק ‎--t (0..1),
	   ומתוכו ה-CSS גוזר סיבוב, עומק ושקיפות. */
	const DOMINO_LEAD = 0.9; // עד כמה לפני קצה-ההובלה מתחילה הנטייה (ביחידות אריח)
	const DOMINO_RAMP = 1.6; // על פני כמה אריחים הנטייה מתפתחת מ-0 למקסימום
	const DOMINO_OPEN = 4; // על פני כמה אריחים נפתח חלון ההקדמה בתחילת הגלילה

	/** @param {number} pos */
	function paintDepth(pos) {
		const el = railEl;
		if (!el || reduceMotion || tileStep <= 0) return;
		/* חלון ההקדמה נפתח ב-smoothstep ולא ב-Math.min: ב-min הוא גדל בקצב 1
		   יחד עם past, ולכן הנטייה רצה בקצב כפול עד לרוויה ושם נחתכת בבת אחת
		   לחצי — קפיצת-קצב שנראית כגליץ' בדיוק בקצה הימני. */
		const u = Math.min(1, pos / (tileStep * DOMINO_OPEN));
		const lead = tileStep * DOMINO_LEAD * u * u * (3 - 2 * u);
		const ramp = tileStep * DOMINO_RAMP;
		const wraps = /** @type {NodeListOf<HTMLElement>} */ (el.querySelectorAll('[data-depth]'));
		for (let i = 0; i < wraps.length; i++) {
			// past = כמה האריח כבר חלף את קצה-ההובלה של החלון הנראה
			const past = pos - (padStartPx + i * tileStep);
			const t = Math.max(0, Math.min(1, (past + lead) / ramp));
			wraps[i].style.setProperty('--t', t < 0.002 ? '0' : t.toFixed(3));
		}
	}

	/** onscroll יורה בתדר פריים — חנק ב-rAF כדי לא לכתוב 6 ערכי state בכל פריים */
	function scheduleRead() {
		if (rafId) return;
		rafId = requestAnimationFrame(() => {
			rafId = 0;
			readScroll();
		});
	}

	$effect(() => {
		const el = railEl;
		if (!el) return;
		const cs = getComputedStyle(el);
		rtl = cs.direction === 'rtl';
		gapPx = parseFloat(cs.columnGap) || GAP_PX;
		padStartPx = parseFloat(cs.paddingInlineStart) || 8;
		reduceMotion = prefersReduce();
		untrack(readScroll); // המדידה לא אמורה לחבר את ה-effect לערכים שהיא כותבת
		const ro = new ResizeObserver(readScroll);
		ro.observe(el);
		return () => {
			ro.disconnect();
			if (rafId) cancelAnimationFrame(rafId);
			rafId = 0;
		};
	});

	/** הרשימה השתנתה (סינון/טעינה) — למדוד מחדש, בלי לתלות בכך את ה-effect שלמעלה */
	$effect(() => {
		void categories.length;
		untrack(readScroll);
	});

	/** נדנוד חד-פעמי "אני זזה" — פעם אחת ב-session, ולא כשמבקשים פחות תנועה */
	$effect(() => {
		const el = railEl;
		if (!el || !overflowing || nudged) return;
		nudged = true;
		if (prefersReduce()) return;
		try {
			if (sessionStorage.getItem('catRailHinted')) return;
			sessionStorage.setItem('catRailHinted', '1');
		} catch {
			return; // Safari במצב פרטי זורק
		}
		const s = rtl ? -1 : 1; // "קדימה" ב-RTL = דלתא שלילית
		const t1 = setTimeout(() => el.scrollBy({ left: s * 36, behavior: 'smooth' }), 700);
		const t2 = setTimeout(() => el.scrollBy({ left: -s * 36, behavior: 'smooth' }), 1250);
		return () => {
			clearTimeout(t1);
			clearTimeout(t2);
		};
	});

	/* גרירה: עכבר/עט מנוהלים ב-JS; מגע נשאר נטיבי כדי לשמור על מומנטום אמיתי */
	/** @param {PointerEvent} e */
	function onRailPointerDown(e) {
		suppressClick = false;
		if (e.button > 0) return;
		pointerId = e.pointerId;
		isTouch = e.pointerType === 'touch';
		startX = e.clientX;
		startY = e.clientY;
		startScroll = railEl ? railEl.scrollLeft : 0;
		maxMove = 0;
		axisLock = null;
		dragging = false;
		hinted = true;
	}

	/** @param {PointerEvent} e */
	function onRailPointerMove(e) {
		if (e.pointerId !== pointerId || !railEl) return;
		// הכפתור שוחרר מחוץ לחלון ולא קיבלנו pointerup — אחרת המסילה נדבקת לסמן
		if (e.pointerType !== 'touch' && e.buttons === 0) {
			endPointer(e, true);
			return;
		}
		const dx = e.clientX - startX,
			dy = e.clientY - startY;
		maxMove = Math.max(maxMove, Math.abs(dx));
		if (isTouch) return; // הדפדפן גולל; אנחנו רק סופרים תזוזה

		if (axisLock === null) {
			if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return;
			axisLock = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
			if (axisLock === 'v') {
				pointerId = -1; // מחווה אנכית — משחררים לתמיד
				return;
			}
			dragging = true;
			railEl.setPointerCapture(e.pointerId);
		}
		e.preventDefault();
		railEl.scrollLeft = startScroll - dx; // דלתא יחסית בלבד ⇒ נכון בכל דפדפן ובשני הכיוונים
	}

	/** @param {PointerEvent} e @param {boolean} cancelled */
	function endPointer(e, cancelled) {
		if (e.pointerId !== pointerId) return;
		// dragging ולא רק maxMove: גרירת עכבר מתחילה כבר ב-LOCK_PX (10px), ובלעדיו
		// גרירה של 10—15px הייתה מסתיימת בבחירת תחום
		if (cancelled || dragging || maxMove > TAP_PX) {
			suppressClick = true;
			dragEndedAt = performance.now();
		}
		if (dragging && railEl?.hasPointerCapture(e.pointerId))
			railEl.releasePointerCapture(e.pointerId);
		dragging = false;
		axisLock = null;
		pointerId = -1;
		readScroll();
	}
	/** @param {PointerEvent} e */
	const onRailPointerUp = (e) => endPointer(e, false);
	/** @param {PointerEvent} e */
	const onRailPointerCancel = (e) => endPointer(e, true);
	/** @param {PointerEvent} e */
	const onRailLostCapture = (e) => endPointer(e, true);

	/** בולם את ה-click שנורה בסוף גרירה. שלב ה-capture על האב רץ לפני היעד,
	 *  וגם לפני ה-delegation של Svelte שיושב על שורש האפליקציה.
	 *  @param {MouseEvent} e */
	function onRailClickCapture(e) {
		if (!suppressClick) return;
		suppressClick = false;
		if (e.detail === 0) return; // Enter/Space מהמקלדת — לא לבלוע
		if (performance.now() - dragEndedAt > CLICK_EXPIRE_MS) return; // דגל ישן — לא לבלוע
		e.stopPropagation();
		e.preventDefault();
	}

	/** dir=1 → קדימה ברשימה (חשיפת הבאים) · dir=-1 → חזרה למובילים
	 *  @param {1 | -1} dir */
	function nudge(dir) {
		const el = railEl;
		if (!el) return;
		hinted = true;
		const step = Math.max(180, el.clientWidth * 0.8);
		el.scrollBy({
			left: (rtl ? -1 : 1) * dir * step,
			behavior: prefersReduce() ? 'auto' : 'smooth'
		});
	}

	/* ── ידית הסקראבר: גרירה פרופורציונלית שמזיזה את המסילה ──────────────
	   ptrInline נמדד מקצה ה-inline-start (מימין ב-RTL) — בדיוק כמו שממקם
	   ה-CSS את הידית — ולכן אותו מיפוי עובד זהה בשני הכיוונים. */
	/** @param {number} clientX */
	function scrubTo(clientX) {
		const el = railEl,
			track = trackEl;
		if (!el || !track) return;
		const rect = track.getBoundingClientRect();
		const trackW = rect.width;
		const max = el.scrollWidth - el.clientWidth;
		if (trackW <= 0 || max <= 0) return;
		const thumbW = Math.min(trackW, (el.clientWidth / el.scrollWidth) * trackW);
		const travel = trackW - thumbW;
		if (travel <= 0) return;
		const ptrInline = rtl ? rect.right - clientX : clientX - rect.left;
		const start = Math.max(0, Math.min(travel, ptrInline - thumbGrab));
		el.scrollLeft = (rtl ? -1 : 1) * (start / travel) * max;
		readScroll(); // עדכון מיידי של --p/--ratio כדי שהידית תדבק לאצבע
	}

	/** @param {PointerEvent} e */
	function onThumbPointerDown(e) {
		if (e.button > 0) return;
		const el = railEl,
			track = trackEl;
		if (!el || !track) return;
		const rect = track.getBoundingClientRect();
		const trackW = rect.width;
		if (trackW <= 0 || el.scrollWidth - el.clientWidth <= 0) return;
		const thumbW = Math.min(trackW, (el.clientWidth / el.scrollWidth) * trackW);
		const travel = trackW - thumbW;
		if (travel <= 0) return;
		const ptrInline = rtl ? rect.right - e.clientX : e.clientX - rect.left;
		const thumbStart = Math.max(0, Math.min(1, progress)) * travel;
		// לחיצה על הידית → אחיזה יחסית (בלי קפיצה); לחיצה על המסילה → מרכוז תחת המצביע
		thumbGrab =
			ptrInline >= thumbStart && ptrInline <= thumbStart + thumbW
				? ptrInline - thumbStart
				: thumbW / 2;
		thumbPointerId = e.pointerId;
		scrubbing = true;
		hinted = true;
		track.setPointerCapture(e.pointerId);
		e.preventDefault();
		scrubTo(e.clientX);
	}

	/** @param {PointerEvent} e */
	function onThumbPointerMove(e) {
		if (e.pointerId !== thumbPointerId) return;
		e.preventDefault();
		scrubTo(e.clientX);
	}

	/** @param {PointerEvent} e */
	function endThumb(e) {
		if (e.pointerId !== thumbPointerId) return;
		if (trackEl?.hasPointerCapture(e.pointerId)) trackEl.releasePointerCapture(e.pointerId);
		thumbPointerId = -1;
		scrubbing = false;
	}

	/** @param {KeyboardEvent} e */
	function onRailKeydown(e) {
		const el = railEl;
		if (!el || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
		const tiles = /** @type {HTMLElement[]} */ (Array.from(el.querySelectorAll('[data-tile]')));
		const i = tiles.indexOf(/** @type {HTMLElement} */ (document.activeElement));
		if (i === -1) return;
		const fwd = rtl ? 'ArrowLeft' : 'ArrowRight'; // ב-RTL שמאלה = הבא
		const next =
			e.key === 'Home'
				? 0
				: e.key === 'End'
					? tiles.length - 1
					: e.key === fwd
						? Math.min(i + 1, tiles.length - 1)
						: Math.max(i - 1, 0);
		if (next === i) return;
		e.preventDefault();
		hinted = true;
		tiles[next].focus(); // הדפדפן גולל פנימה; scroll-padding שומר על טבעת הפוקוס
	}

	/** שם האריח לקורא-מסך. תחום ריק אינו "הצג עסקים" — אין מה להציג, ומי
	 *  שמנווט בהקראה צריך לדעת את זה לפני הלחיצה ולא אחריה.
	 *  @param {RailCat} c */
	const tileLabel = (c) =>
		c.count === 0
			? `תחום ${c.label} — אין בו עדיין עסקים`
			: `הצג עסקים בתחום ${c.label} — ${c.count === 1 ? 'עסק אחד' : `${c.count} עסקים`}`;

	/** @param {string} key @param {MouseEvent} [e] */
	function pick(key, e) {
		// חגורה שנייה מעל onclickcapture; Enter/Space מהמקלדת (detail=0) פטורים ממנה
		if (e?.detail !== 0 && performance.now() - dragEndedAt < CLICK_GUARD_MS) return;
		onselect?.(key === selected ? '' : key); // לחיצה חוזרת על תחום נבחר = ביטול הסינון
	}
</script>

<section class="cat-section" aria-labelledby="cat-rail-title">
	<div class="mx-auto max-w-7xl">
		<!-- הכותרת לבדה, ממורכזת. תת-הכותרת ("בחרו תחום — או גררו...") הוסרה:
		     אותה הוראה בדיוק חוזרת בשורת הבקרים שמתחת למסילה, והיא גזלה שורה
		     שלמה מהמסך הראשון בנייד. -->
		<div class="mb-2 px-1 text-center">
			<h2 id="cat-rail-title" class="text-xl font-extrabold text-gray-100">{title}</h2>
		</div>

		<p id="cat-rail-help" class="sr-only">
			רשימת תחומים נגללת לרוחב, מסודרת לפי מספר העסקים. אפשר לגרור אותה, או לעבור בין התחומים עם
			מקשי החצים ימינה ושמאלה, ומקשי Home ו-End.
		</p>

		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			role="group"
			aria-labelledby="cat-rail-title"
			aria-describedby="cat-rail-help"
			onkeydown={onRailKeydown}
		>
			<ul
				id="cat-rail"
				bind:this={railEl}
				class="cat-rail"
				class:is-dragging={dragging}
				style="--f-l:{rtl ? fadeTailPx : fadeLeadPx}px; --f-r:{rtl
					? fadeLeadPx
					: fadeTailPx}px; --sx:{rtl ? 1 : -1}; --o:{rtl ? '0%' : '100%'}"
				onscroll={scheduleRead}
				onpointerdown={onRailPointerDown}
				onpointermove={onRailPointerMove}
				onpointerup={onRailPointerUp}
				onpointercancel={onRailPointerCancel}
				onlostpointercapture={onRailLostCapture}
				onclickcapture={onRailClickCapture}
			>
				{#each categories as cat, i (cat.key)}
					<!-- העטיפה נושאת את טרנספורם הדומינו ולא ה-li ולא הכפתור: לכפתור יש
					     טרנספורם משלו ב-hover וב-active, ושתי הצהרות transform על אותו
					     אלמנט דורסות אחת את השנייה. -->
					<li class="cat-item">
						<span class="cat-3d" data-depth>
							<button
								type="button"
								data-tile
								class="cat-tile"
								class:is-selected={selected === cat.key}
								onclick={(e) => pick(cat.key, e)}
								aria-pressed={selected === cat.key}
								aria-label={tileLabel(cat)}
							>
								<!-- תחום ריק מקבל תג אפור: "0" בגלולה הכחולה הזוהרת נקרא כתקלה -->
								<span class="cat-count-badge" class:is-empty={cat.count === 0} aria-hidden="true"
									>{cat.count}</span
								>
								<span class="cat-ico" aria-hidden="true">
									{#if cat.image}
										<!-- תמונה שהסופר-אדמין העלה במקום האימוג'י; alt ריק — האריח כולו
										     כבר מתויג ב-aria-label, ותמונה דקורטיבית לא צריכה שם משלה.
										     המיקום והזום שנקבעו במסך הניהול מוחלים עם אותה פעולה של
										     הפרסומות (adImgFit) בתוך משבצת חתוכה.
										     המקור עובר דרך ממטב התמונות ($lib/img.js) ברוחב האריח בלבד:
										     המקור הוא קובץ של מגה-בייטים, וכאן הוא נצרך כ~120px.
										     האריחים הראשונים אינם lazy — הם מעל הקיפול, ו-lazy היה דוחה
										     את הבקשה שלהם עד אחרי חישוב הפריסה. -->
										<span class="cat-imgbox">
											<img
												class="cat-img"
												src={imgUrl(cat.image, 384)}
												srcset={imgSrcSet(cat.image, [128, 256, 384])}
												sizes="(min-width: 768px) 9.4rem, 7.6rem"
												alt=""
												loading={i < 6 ? 'eager' : 'lazy'}
												fetchpriority={i < 6 ? 'high' : 'auto'}
												decoding="async"
												draggable="false"
												use:imgFallback={cat.image}
												use:adImgFit={parseAdImageFit(cat.imageFit)}
											/>
										</span>
									{:else}
										{cat.icon}
									{/if}
								</span>
								<span class="cat-label">{cat.label}</span>
							</button>
						</span>
					</li>
				{/each}
				<!-- מרווח סיום אמיתי: padding-inline-end נבלע בסקרולר flex, והוא חייב
				     להיות רחב כמו המסכה כדי שהאריח האחרון לא יישאר מעומעם -->
				<li class="cat-spacer" data-spacer aria-hidden="true"></li>
			</ul>
		</div>

		<!-- בקרי החשיפה מרוכזים מתחת למסילה, צמודים לאלמנט שהם מזיזים:
		     רמז (בלי מסגרת, לא ככפתור) מעל שורת חץ ← סקראבר נגרר → חץ+מונה.
		     פסקת הרמז מוסתרת בנייד: אותה הוראה כבר כתובה מעל המסילה, גרירה
		     היא מחווה טבעית במגע, והנדנוד האוטומטי והגלולה "עוד N" משלימים. -->
		<div class="mt-2 flex flex-col items-center gap-2 {overflowing ? '' : 'invisible'}">
			<p
				class="hidden items-center gap-1.5 text-sm font-bold text-gray-400 md:inline-flex"
				aria-hidden="true"
			>
				<span>גררו את השורה כדי לגלות עוד</span>
				<span class="cat-hint-arrow" class:is-live={!hinted}>↔</span>
			</p>

			<div class="cat-controls flex w-full max-w-md items-center justify-center gap-2">
				<button
					type="button"
					class="cat-nav"
					aria-controls="cat-rail"
					aria-disabled={atStart}
					aria-label="חזרה לתחילת רשימת התחומים"
					onclick={() => {
						if (!atStart) nudge(-1);
					}}
				>
					<svg
						viewBox="0 0 24 24"
						class="h-5 w-5"
						aria-hidden="true"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d={rtl ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
					</svg>
				</button>

				<div
					bind:this={trackEl}
					class="cat-track"
					class:is-scrubbing={scrubbing}
					style="--p:{progress}; --ratio:{thumbRatio}"
					aria-hidden="true"
					onpointerdown={onThumbPointerDown}
					onpointermove={onThumbPointerMove}
					onpointerup={endThumb}
					onpointercancel={endThumb}
					onlostpointercapture={endThumb}
				>
					<span class="cat-thumb"></span>
				</div>

				<!-- הגלולה היא גם המונה של מה שמוסתר וגם דרך הגישה ללא גרירה -->
				<button
					type="button"
					class="cat-nav cat-nav--pill"
					aria-controls="cat-rail"
					aria-disabled={atEnd}
					aria-label={atEnd ? 'כל התחומים מוצגים' : `הצג עוד ${hiddenCount} תחומים`}
					onclick={() => {
						if (!atEnd) nudge(1);
					}}
				>
					<svg
						viewBox="0 0 24 24"
						class="h-5 w-5"
						aria-hidden="true"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d={rtl ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
					</svg>
					<span class="text-xs font-black tabular-nums" aria-hidden="true">
						{atEnd ? 'הכל מוצג' : `עוד ${hiddenCount}`}
					</span>
				</button>
			</div>
		</div>
	</div>
</section>

<style>
	.cat-section {
		/* התחתון גדול מהעליון: שורת הבקרים נגמרת ממש בקצה המקטע, וכותרת הקומה
		   שמתחתיה נצמדה אליה. הריווח כאן שייך למסילה ולא לקומה שאחריה.
		   בנייד הוא הדוק יותר — כל פיקסל אנכי דוחף את התוצאות מתחת לקיפול. */
		padding-block: 0.25rem 0.75rem;
	}
	@media (min-width: 768px) {
		.cat-section {
			padding-block: 0.25rem 1.25rem;
		}
	}

	/* ═══ המסילה ═══ */
	.cat-rail {
		display: flex;
		gap: 0.75rem; /* חייב להתאים ל-GAP_PX בסקריפט */
		list-style: none;
		margin: 0;
		/* למעלה 1.5rem: תג הכמות מרחף חצי מעל קצה האריח, ועם ההרמה ב-hover
		   וההגדלה של הנבחר הוא מטפס עד ‎~1.3rem‎ — overflow-y:hidden היה חותך אותו.
		   למטה 0.5rem בנייד (בדסקטופ 1rem במדיה-קוורי למטה) — הידוק אנכי. */
		padding: 1.5rem 0.5rem 0.5rem; /* טבעת הפוקוס היא 3px + offset — 4px לא הספיקו */
		overflow-x: auto;
		overflow-y: hidden;
		overscroll-behavior-x: contain; /* בלי back-swipe של הדפדפן באייפון */
		-webkit-overflow-scrolling: touch;
		scroll-padding-inline: 2rem; /* תואם את רוחב המסכה; שומר על טבעת הפוקוס במקלדת */
		/* אין כאן scroll-snap-type — ואסור להחזיר אותו: ההצמדה קופצת מיידית ובלי
		   אנימציה, וכל קפיצה כזו קופצת גם את נטיית הדומינו (‎--t הוא פונקציה של
		   מקום הגלילה). scroll-behavior: smooth לא מוצהר בכוונה — הוא היה הופך
		   כל גרירה למקרטעת. */
		cursor: grab;
		user-select: none;
		-webkit-user-select: none;
		scrollbar-width: none;
		-ms-overflow-style: none;
		/* דהייה בקצוות במסכה ולא בגרדיאנט צבוע — הרקע כאן כהה ולא אחיד */
		--cat-mask: linear-gradient(
			to right,
			transparent 0,
			#000 var(--f-l, 2rem),
			#000 calc(100% - var(--f-r, 2rem)),
			transparent 100%
		);
		-webkit-mask-image: var(--cat-mask);
		mask-image: var(--cat-mask);
	}
	.cat-rail::-webkit-scrollbar {
		display: none;
	}
	.cat-rail.is-dragging {
		cursor: grabbing;
		scroll-behavior: auto;
	}
	.cat-rail.is-dragging .cat-tile {
		transition: none;
	}
	@media (hover: none) {
		.cat-rail {
			cursor: default;
		}
	}

	.cat-item {
		flex: 0 0 auto;
		display: flex;
	}
	.cat-spacer {
		flex: 0 0 2rem;
		display: block;
	} /* ≥ רוחב המסכה, אחרת האריח האחרון נשאר מעומעם */

	/* ═══ דומינו תלת-מימדי ═══
	   ‎--t (0..1) נכתב מה-JS לפי מקומו של האריח ביחס לקצה-ההובלה, וכאן הוא נפרש
	   לנסיגה לעומק. ‎--o היא נקודת הציר, על הקצה שפונה אל האריח הבא (שמאל ב-RTL),
	   ולכן ההצטמקות נבלעת אל הקצה היוצא והרווח אל השכן אינו גדל.
	   perspective מקומי לכל אריח ולא על המסילה: perspective על מכל-גלילה מוליד
	   באגי נקודת-מגוז בין הדפדפנים. */
	.cat-3d {
		display: flex;
		transform-origin: var(--o, 0%) 50%;
		transform: perspective(460px) translateZ(calc(var(--t, 0) * -110px))
			rotateY(calc(var(--t, 0) * var(--sx, 1) * 22deg));
		opacity: calc(1 - var(--t, 0) * 0.35);
	}
	@media (prefers-reduced-motion: reduce) {
		.cat-3d {
			transform: none;
			opacity: 1;
		}
	}

	/* ═══ אריח ═══
	   המידות כאן הן של הנייד: אריח צר ⇒ ~4 תחומים במסך אחד במקום 3,
	   וההצצה לאריח הבא נשמרת. מ-md ומעלה חוזרים לאריח הגדול. */
	.cat-tile {
		position: relative;
		width: clamp(6rem, 24vw, 8rem); /* vw ⇒ ההצצה לאריח הבא מובטחת בכל רוחב מסך */
		min-height: 10rem; /* גבוה יותר — מפנה מקום לתמונת תחום גדולה, כמו בגמ"חים */
		height: 100%; /* ה-li נמתח לגובה השורה; בלי זה תחתית האריחים מתפרעת */
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		/* ריפוד צר — התמונה היא העיקר באריח, וכל מה שנגזר ממנו לשוליים נגזל
		   ממנה. מספיק שהמסגרת השחורה לא תיגע במסגרת האריח */
		padding: 0.4rem 0.2rem;
		border-radius: 0.85rem;
		border: 1px solid #374151; /* gray-700 */
		background: linear-gradient(160deg, #1f2937 0%, #131c2b 55%, #0b1220 100%);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.05),
			0 12px 26px -20px rgba(0, 0, 0, 0.95);
		transition:
			transform 0.18s ease,
			border-color 0.18s ease,
			box-shadow 0.18s ease,
			background 0.18s ease;
		cursor: pointer;
		text-align: center;
	}
	/* אף צאצא לא יבלע pointermove ולא יתחיל drag-image */
	.cat-tile > * {
		pointer-events: none;
	}

	/* hover רק במכשירים שיש בהם — אחרת הוא נדבק אחרי גרירה במסך מגע */
	@media (hover: hover) {
		.cat-rail:not(.is-dragging) .cat-tile:hover {
			transform: translateY(-4px);
			border-color: #3b82f6; /* blue-500 */
			background: linear-gradient(160deg, #253449 0%, #18243a 60%, #0e1729 100%);
			box-shadow:
				inset 0 1px 0 rgba(255, 255, 255, 0.09),
				0 18px 34px -20px rgba(0, 0, 0, 1);
		}
	}
	/* אותה סגוליות כמו כלל ה-hover ואחריו בסדר המקורות, אחרת ההרמה גוברת על הלחיצה */
	.cat-rail:not(.is-dragging) .cat-tile:active {
		transform: translateY(-1px) scale(0.985);
	}

	/* ═══ התחום הנבחר ═══
	   האריח גדל מעט ונענד טבעת כחולה, כדי שברור אילו תוצאות מוצגות מטה.
	   הכללים יושבים אחרי ה-hover/‎:active ובאותה סגוליות, אחרת ההרמה ב-hover
	   דורסת את ה-scale (שתי הצהרות transform על אותו אלמנט). */
	.cat-rail .cat-tile.is-selected {
		transform: scale(1.07);
		border-color: #60a5fa; /* blue-400 */
		background: linear-gradient(160deg, #1e3a8a 0%, #1b2b5c 58%, #111c38 100%);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.12),
			0 0 0 2px rgba(96, 165, 250, 0.45),
			0 18px 32px -18px rgba(0, 0, 0, 1);
	}
	.cat-rail .cat-tile.is-selected .cat-label {
		color: #dbeafe;
	}
	@media (hover: hover) {
		.cat-rail:not(.is-dragging) .cat-tile.is-selected:hover {
			transform: translateY(-4px) scale(1.07);
		}
	}
	.cat-rail:not(.is-dragging) .cat-tile.is-selected:active {
		transform: translateY(-1px) scale(1.04);
	}

	/* מהטאבלט ומעלה יש רוחב בשפע — אריח גדול */
	@media (min-width: 768px) {
		.cat-tile {
			width: clamp(8rem, 32vw, 10rem);
			min-height: 13rem;
			gap: 0.45rem;
			padding: 0.5rem 0.3rem;
			border-radius: 1rem;
		}
	}

	/* תג הכמות — כמה עסקים בתחום. גלולה שמתרחבת לפי מספר הספרות,
	   רוכבת חצי באוויר על הפינה העליונה (היסט שלילי בגובה חצי-תג);
	   הטבעת בצבע רקע הדף (gray-950) מחדדת את קו החיתוך על קצה האריח */
	.cat-count-badge {
		position: absolute;
		top: -0.6rem;
		inset-inline-end: -0.4rem; /* לוגי ⇒ נוחת בפינה הנכונה ב-RTL */
		display: grid;
		place-items: center;
		min-width: 1.2rem;
		height: 1.2rem;
		padding: 0 0.3rem;
		z-index: 2;
		border-radius: 999px;
		font-size: 0.66rem;
		font-weight: 900;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		color: #06182f;
		background: linear-gradient(145deg, #93c5fd, #3b82f6);
		box-shadow:
			0 0 0 2px #030712,
			0 2px 6px -2px rgba(59, 130, 246, 0.8);
	}
	/* תחום שעדיין ריק — אותה גלולה בדיוק, בלי הזוהר הכחול שמזמין ללחוץ */
	.cat-count-badge.is-empty {
		color: #cbd5e1; /* gray-300 */
		background: linear-gradient(145deg, #4b5563, #374151);
		box-shadow: 0 0 0 2px #030712;
	}
	.cat-ico {
		display: grid;
		place-items: center;
		width: 100%;
		min-height: 2.5rem;
		font-size: 2rem;
		line-height: 1;
	}
	/* תמונת תחום שהועלתה — גדולה, ממלאת כמעט את כל רוחב האריח (כמו בגמ"חים).
	   ריבוע קבוע ⇒ המיקום/זום שנקבעו במשבצת הריבועית של מסך הניהול נשמרים.
	   המשבצת (cat-imgbox) היא העוגן של adImgFit: התמונה ממוקמת אבסולוטית
	   בתוכה לפי המיקום והזום שנקבעו שם. */
	.cat-imgbox {
		position: relative;
		overflow: hidden;
		width: 7.6rem; /* = הרוחב הפנימי של האריח; max-width מקצץ במסכים צרים */
		max-width: 100%;
		aspect-ratio: 1 / 1;
		border-radius: 0.7rem;
		/* מסגרת דקה — קו הפרדה בלבד; מסגרת עבה גזלה מהתמונה עצמה */
		border: 1px solid #000;
		background: #0b1220;
		box-shadow: 0 10px 22px -12px rgba(0, 0, 0, 0.95);
	}
	.cat-img {
		width: 100%;
		height: 100%;
		object-fit: cover; /* המראה עד שהפעולה מודדת ומחליפה במיקום מפורש */
	}
	.cat-label {
		font-size: 0.72rem;
		font-weight: 700;
		line-height: 1.15;
		color: #e5e7eb;
	}

	@media (min-width: 768px) {
		.cat-count-badge {
			top: -0.75rem;
			inset-inline-end: -0.5rem;
			min-width: 1.5rem;
			height: 1.5rem;
			padding: 0 0.45rem;
			font-size: 0.78rem;
		}
		.cat-ico {
			min-height: 3.5rem;
			font-size: 2.5rem;
		}
		.cat-imgbox {
			width: 9.4rem; /* = הרוחב הפנימי של האריח במסך רחב, בלי שוליים מבוזבזים */
			border-radius: 0.85rem;
			border-width: 2px;
		}
		.cat-label {
			font-size: 0.8125rem;
		}
	}

	/* ═══ פקדי ניווט ═══ */
	.cat-nav {
		display: inline-grid;
		grid-auto-flow: column;
		align-items: center;
		gap: 0.35rem;
		place-items: center;
		min-width: 2.75rem; /* יעד מגע נדיב בנייד */
		height: 2.75rem;
		padding: 0 0.5rem;
		border-radius: 999px;
		color: #dbe4fb;
		background: rgba(31, 41, 55, 0.92); /* gray-800 */
		border: 1px solid #374151;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.07),
			0 6px 16px -10px rgba(0, 0, 0, 0.9);
		cursor: pointer;
		transition:
			background 0.18s ease,
			border-color 0.18s ease,
			opacity 0.18s ease;
	}
	@media (min-width: 768px) {
		.cat-nav {
			min-width: 2.25rem;
			height: 2.25rem;
		}
	}
	/* לוגי ולא פיזי: ההתחלה היא צד החץ, הסוף הוא צד הטקסט */
	.cat-nav--pill {
		padding-block: 0;
		padding-inline: 0.6rem 0.85rem;
		color: #93c5fd;
	}
	.cat-nav:hover {
		background: #263141;
		border-color: #4b5563;
	}
	/* aria-disabled ולא disabled — כדי לא לחטוף פוקוס ממשתמש מקלדת שהגיע לקצה */
	.cat-nav[aria-disabled='true'] {
		opacity: 0.35;
		cursor: default;
	}
	.cat-nav[aria-disabled='true']:hover {
		background: rgba(31, 41, 55, 0.92);
		border-color: #374151;
	}

	/* ═══ סקראבר ═══ */
	.cat-track {
		position: relative;
		width: min(22rem, 70%);
		height: 0.375rem;
		border-radius: 999px;
		background: #111827;
		box-shadow: inset 0 0 0 1px #374151;
		cursor: pointer;
		touch-action: none; /* גרירת-מגע מזיזה את המסילה, לא גוללת את הדף */
	}
	/* אזור-מגע גבוה יותר בלי לעבות את הפס הדק — קל לתפוס גם באצבע */
	.cat-track::before {
		content: '';
		position: absolute;
		inset: -0.7rem 0;
	}
	.cat-thumb {
		position: absolute;
		top: 0;
		bottom: 0;
		border-radius: 999px;
		width: calc(var(--ratio, 1) * 100%);
		/* inset-inline-start מודע-כיוון: ב-RTL זה היסט מימין ⇒ p=0 = המובילים */
		inset-inline-start: calc(var(--p, 0) * (100% - var(--ratio, 1) * 100%));
		background: linear-gradient(90deg, #60a5fa, #a78bfa);
		box-shadow: 0 0 10px -2px rgba(96, 165, 250, 0.7);
		cursor: grab;
	}
	.cat-track.is-scrubbing {
		cursor: grabbing;
	}
	.cat-track.is-scrubbing .cat-thumb {
		cursor: grabbing;
		filter: brightness(1.12);
	}

	/* ═══ רמז ═══ */
	.cat-controls .cat-track {
		flex: 1 1 auto;
		width: auto;
		min-width: 0;
	}
	.cat-hint-arrow {
		display: inline-block;
	}
	.cat-hint-arrow.is-live {
		animation: cat-hint 1.6s ease-in-out infinite;
	}
	@keyframes cat-hint {
		0%,
		100% {
			transform: translateX(0);
		}
		50% {
			transform: translateX(5px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.cat-hint-arrow,
		.cat-hint-arrow.is-live {
			animation: none !important;
			transform: none !important;
		}
		.cat-tile,
		.cat-tile:hover,
		.cat-tile:active {
			transform: none !important;
		}
		.cat-rail {
			scroll-behavior: auto !important;
		}
	}
</style>
