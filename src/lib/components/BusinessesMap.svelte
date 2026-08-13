<script>
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { cityLabels, resolveServiceArea, serviceShapes } from '$lib/serviceArea.js';
	import 'leaflet/dist/leaflet.css';

	/** full — המופע שבתוך שכבת המסך המלא (ראו LazyMap): הוא ממלא את הגובה
	   שנותנים לו, וכל מחוות הזום פתוחות בו. המופע הקטן שבדף הבית הוא תצוגה
	   מקדימה: גלגלת ולחיצה כפולה אינן מזיזות אותו — הן פותחות את הגדול.
	   @type {{ businesses: any[], full?: boolean, onexpand?: () => void }} */
	let { businesses = [], full = false, onexpand = undefined } = $props();

	/** @type {HTMLDivElement} */
	let mapEl;
	/** @type {any} */
	let map;
	/** @type {any} */
	let markersLayer;
	/** @type {any} */
	let labelsLayer;
	/** @type {any} */
	let L;
	/** @type {any} */
	let pinIcon;

	// האייקון הדיפולטי של Leaflet מושך קובצי PNG מ-leaflet/dist/images לפי נתיב
	// שהוא מנחש מה-CSS — נתיב ש-Vite לא מגיש, ולכן במקום פינים הופיעו ריבועי
	// "תמונה שבורה". פין SVG inline מבטל את התלות: אפס בקשות רשת, חד בכל צפיפות
	// מסך, ובצבע של הכפתור בפופאפ.
	// 15×21 ולא 22×31: המפה יושבת בחצי רוחב מסך (ובנייד בפחות מזה), ובגודל
	// הקודם שני פינים שכנים בגוש דן נגעו זה בזה והכתימו את האזור בכחול.
	const PIN_SVG = `<svg viewBox="0 0 24 34" width="15" height="21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 .9C6 .9 1.1 5.8 1.1 11.8c0 8.3 9.9 20.4 10.3 20.9a.8.8 0 0 0 1.2 0c.4-.5 10.3-12.6 10.3-20.9C22.9 5.8 18 .9 12 .9Z" fill="#2563eb" stroke="#fff" stroke-width="1.7"/><circle cx="12" cy="11.9" r="4.1" fill="#fff"/></svg>`;

	/* הרצפה של המסגור: מה שנראה תמיד על המפה, גם כשכל הנקודות מצטופפות
	   בגוש דן. גובה הקופסה (2.8°) הוא שקובע את רמת הזום — המסגרת גבוהה
	   וצרה, ולכן צירי מערב-מזרח כמעט אינם משפיעים עליה — ומרכזה הוא מרכז
	   המפה, ולכן הזזת הקופסה היא הדרך להזיז את התצוגה בלי לשנות את הזום.
	   הכיוונים הפוכים לתחושה: קופסה שיורדת דרומה מושכת את המפה עצמה
	   צפונה במסגרת, וקופסה שזזה מערבה מושכת אותה מזרחה.

	   מ-30.35 עד 33.15: הגליל נוגע בקצה העליון של המסגרת (ולא נשאר מתחתיו
	   פס של לבנון), והנגב נמשך למטה. בלי הערבה ואילת — הן שליש נוסף של
	   אורך המדינה וכמעט בלי עסקים, והכללתן הייתה מקטינה את כל השאר כדי
	   להראות שטח ריק. נקודה שתיפול מחוץ לקופסה עדיין מותחת אותה אליה. */
	const COUNTRY_BOUNDS = /** @type {[[number, number], [number, number]]} */ ([
		[30.35, 34.2],
		[33.15, 35.55]
	]);

	/* כמה להתקרב מעבר למסגור של הקופסה, ברמות זום. הכיוון היחיד לכוונון
	   עדין של המפה: 0.1 = 7% קרוב יותר, 0.2 = 14%, ורמה שלמה היא פי 2 —
	   ולכן כפתורי ה-+/− של Leaflet, שקופצים רמה, אינם משמשים לכך. */
	const ZOOM_NUDGE = 0.2;

	/* מפת הבית מציגה נקודות בלבד — בלי מעגלי אזור. המעגל עונה על שאלה ("עד
	   לאן מגיע העסק הזה") ששייכת לכרטיסייה בודדת; בתצוגה של כל העסקים יחד
	   הם נערמו לערפל כחול ומתחו את המסגור מהגליל ועד אילת. מפת העסק הבודד
	   (ServiceAreaMap) ממשיכה לצייר אזור — שם זו התשובה הנכונה. */

	/** @param {any} b */
	const hasCoords = (b) => typeof b.lat === 'number' && typeof b.lng === 'number';

	// עסק עם קואורדינטות אמיתיות (lat/lng) מקבל פין במקומו המדויק
	const mapped = $derived(businesses.filter(hasCoords));

	// לשאר, המקום נגזר מ"אזור מכירה" — טקסט חופשי — ולכן הפין יושב על מרכז
	// היישוב או האזור, כקירוב. עסק ארצי/אונליין אינו מקובע לשום נקודה.
	const areas = $derived(
		businesses.filter((b) => !hasCoords(b)).map((b) => ({ b, area: resolveServiceArea(b) }))
	);

	/* כמה עסקים באותו מקום = נקודה אחת, עם פופאפ שמונה את כולם במקום להסתיר
	   את התחתונים. המיזוג לפי התווית ולא לפי המפתח: serviceShapes נותן לאותו
	   יישוב מפתחות שונים לפי הרדיוס ("והסביבה"), ולאזור מוארך כמה עיגולים
	   לאורכו — וכנקודה כל אלה הם מקום אחד. */
	const points = $derived.by(() => {
		/** @type {Record<string, {label: string, lat: number, lng: number, items: any[]}>} */
		const groups = {};
		for (const { b, area } of areas) {
			for (const s of serviceShapes(area)) {
				// "כל הארץ" אינו מקום, ואין נקודה שמייצגת אותו בלי לשקר
				if (s.type !== 'circle') continue;
				const g = (groups[s.label] ??= { label: s.label, lat: s.lat, lng: s.lng, items: [] });
				if (!g.items.includes(b)) g.items.push(b);
			}
		}
		return Object.values(groups);
	});

	const drawn = $derived(mapped.length > 0 || points.length > 0);

	/** קישור לעסק — DOM node עם textContent, לא string concat (חסין XSS). @param {any} b */
	function bizLink(b) {
		const a = document.createElement('a');
		a.textContent = b.name || 'ללא שם';
		a.href = `/business/${b.documentId}`;
		a.addEventListener('click', (e) => {
			e.preventDefault();
			goto(a.getAttribute('href') || '/');
		});
		return a;
	}

	/** @param {any} b */
	function markerPopup(b) {
		const box = document.createElement('div');
		box.setAttribute('dir', 'rtl');
		box.style.textAlign = 'right';
		box.style.minWidth = '180px';
		const h = document.createElement('h3');
		h.textContent = b.name || '';
		h.style.cssText = 'margin:0 0 6px;font-size:15px;font-weight:700;color:#111';
		box.appendChild(h);
		if (b.category) {
			const c = document.createElement('span');
			c.textContent = b.category;
			c.style.cssText =
				'display:inline-block;background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:12px;font-size:11px';
			box.appendChild(c);
		}
		if (b.discount) {
			const d = document.createElement('p');
			d.textContent = '🎁 ' + b.discount;
			d.style.cssText = 'margin:6px 0 0;font-size:12px;color:#059669;font-weight:600';
			box.appendChild(d);
		}
		const a = bizLink(b);
		a.textContent = 'מעבר לעסק »';
		a.style.cssText =
			'display:inline-block;margin-top:8px;padding:5px 12px;background:#2563eb;color:#fff;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none';
		box.appendChild(a);
		return box;
	}

	/** @param {{label:string, items:any[]}} group */
	function areaPopup(group) {
		const box = document.createElement('div');
		box.setAttribute('dir', 'rtl');
		box.style.cssText = 'text-align:right;min-width:190px;max-height:220px;overflow:auto';
		const h = document.createElement('h3');
		h.textContent = group.label || 'אזור עבודה';
		h.style.cssText = 'margin:0 0 2px;font-size:14px;font-weight:700;color:#111';
		box.appendChild(h);
		const sub = document.createElement('p');
		sub.textContent = `${group.items.length} עסקים · מיקום מקורב`;
		sub.style.cssText = 'margin:0 0 6px;font-size:11px;color:#6b7280';
		box.appendChild(sub);
		const ul = document.createElement('ul');
		ul.style.cssText = 'margin:0;padding:0;list-style:none;display:grid;gap:4px';
		for (const b of group.items) {
			const li = document.createElement('li');
			const a = bizLink(b);
			a.style.cssText = 'font-size:12px;color:#1d4ed8;text-decoration:none;font-weight:600';
			li.appendChild(a);
			ul.appendChild(li);
		}
		box.appendChild(ul);
		return box;
	}

	/* שמות היישובים, בעברית, מצוירים על ידינו — ראו cityLabels ב-serviceArea.
	   הרשימה נגזרת מהזום ומהנקודות שעל המפה, ולכן היא נבנית מחדש בכל
	   zoomend ובכל שינוי סינון: בתצוגת כל הארץ נשארים חמישה עוגנים ועוד
	   היישובים שיש בהם עסק, ובזום קרוב נפתחת הרשימה כולה. */
	function renderLabels() {
		if (!map || !L || !labelsLayer) return;
		labelsLayer.clearLayers();

		// היישוב שיש עליו נקודה הוא התשובה שהמפה נשאלה עליה, ולכן הוא נכתב
		// גדול יותר ובכחול. "כל הארץ" ואזורים אינם יישובים ואין להם רשומה
		// בטבלת הקואורדינטות, ולכן הם נושרים מאליהם.
		const featured = new Set(points.map((p) => p.label));

		/* דחיסה: 111 שמות בזום קרוב, או עשרים נקודות בגוש דן, נדפסים זה על
		   גבי זה. לכן כל תווית נבחנת מול אלה שכבר הונחו, ומי שמתנגשת נושרת.
		   הרוחב מוערך מאורך השם — מדידה אמיתית דורשת רינדור של כל תווית. */
		/** @type {{x1: number, x2: number, y1: number, y2: number}[]} */
		const boxes = [];

		for (const c of cityLabels(map.getZoom(), featured)) {
			const p = map.latLngToLayerPoint([c.lat, c.lng]);
			const half = c.name.length * (c.featured ? 3.9 : 3.2) + 4;
			const box = { x1: p.x - half, x2: p.x + half, y1: p.y + 2, y2: p.y + 18 };
			if (boxes.some((b) => box.x1 < b.x2 && box.x2 > b.x1 && box.y1 < b.y2 && box.y2 > b.y1))
				continue;
			boxes.push(box);

			const el = document.createElement('span');
			el.textContent = c.name;
			L.marker([c.lat, c.lng], {
				// iconAnchor שלילי בציר Y מוריד את התווית אל מתחת לנקודה, שלא
				// תשב על הפין; הקופסה רחבה והטקסט ממורכז בה, ולכן שם ארוך
				// גולש לשני הצדדים במידה שווה ונשאר ממורכז על היישוב.
				icon: L.divIcon({
					html: el,
					className: c.featured ? 'city-label city-label-key' : 'city-label',
					iconSize: [120, 16],
					iconAnchor: [60, -3]
				}),
				pane: 'cityLabels',
				interactive: false,
				keyboard: false
			}).addTo(labelsLayer);
		}
	}

	function render() {
		if (!map || !L || !markersLayer) return;
		markersLayer.clearLayers();

		// המסגור מתחיל מקופסת הארץ ומתרחב לפי הנקודות, ולא נבנה מהן בלבד:
		// רוב העסקים יושבים בגוש דן, ומסגור הדוק אליהם הצטמצם לפס צר —
		// מפה שנקראת כמפת אזור ולא כמפת הארץ, ושמי שמחפש בפריפריה לא מזהה
		// בה את עצמו. COUNTRY_BOUNDS הוא רצפה בלבד; נקודה מחוצה לה (אילת,
		// מטולה) עדיין מותחת את המסגרת אליה.
		const fit = L.latLngBounds(COUNTRY_BOUNDS);

		for (const g of points) {
			const marker = L.marker([g.lat, g.lng], { icon: pinIcon, riseOnHover: true }).addTo(
				markersLayer
			);
			marker.bindPopup(areaPopup(g));
			marker.bindTooltip(`${g.label} · ${g.items.length} עסקים`, { direction: 'top' });
			fit.extend(marker.getLatLng());
		}

		for (const b of mapped) {
			const marker = L.marker([b.lat, b.lng], { icon: pinIcon, riseOnHover: true }).addTo(
				markersLayer
			);
			marker.bindPopup(markerPopup(b));
			marker.bindTooltip(b.name || '', { direction: 'top' });
			fit.extend(marker.getLatLng());
		}

		// הפין מצויר כלפי מעלה מהקואורדינטה, ולכן השוליים העליונים גדולים
		// יותר — אחרת ראש הפין הצפוני נחתך. הצדדיים צרים: כל פיקסל שוליים
		// במסגרת צרה עולה ברמת זום.
		// הקופסה תמיד חוקית (COUNTRY_BOUNDS), ולכן אין כאן בדיקת isValid.
		map.fitBounds(fit, {
			paddingTopLeft: [4, 24],
			paddingBottomRight: [4, 6],
			maxZoom: 14
		});
		// ההידוק הסופי, שנבחר ידנית מול המסך (ZOOM_NUDGE).
		// setZoom ולא קופסה קטנה יותר: הוא מקרב סביב מרכז המפה, ולכן
		// המרכז שנבחר נשמר בדיוק והקירוב נגזל מהשוליים בלבד.
		map.setZoom(Math.min(map.getZoom() + ZOOM_NUDGE, 14), { animate: false });
	}

	onMount(() => {
		(async () => {
			L = (await import('leaflet')).default;
			// iconAnchor בקצה התחתון של הפין — כך החוד יושב בדיוק על הקואורדינטה;
			// ה-anchors השליליים מרימים את הפופאפ והתיאור אל מעל ראש הפין.
			pinIcon = L.divIcon({
				html: PIN_SVG,
				className: 'biz-pin',
				iconSize: [15, 21],
				iconAnchor: [7, 21],
				popupAnchor: [0, -20],
				tooltipAnchor: [0, -20]
			});
			// תצוגת פתיחה על הארץ, עד ש-render ממסגר לפי COUNTRY_BOUNDS.
			// zoomSnap ברירת המחדל הוא 1, ולכן fitBounds מעגל תמיד כלפי מטה
			// לרמת זום שלמה — עד פי 2 קטן מדי, וכך הארץ ישבה זעירה באמצע עם
			// אוויר מסביבה. בעשיריות רמה המסגור נעצר צמוד לקופסה: רבע רמה
			// הוא כבר קפיצה של ~19% ואי אפשר לכוון בו עדין מזה (כפתורי
			// ה-+/− של Leaflet קופצים רמה שלמה — פי 2).
			map = L.map(mapEl, {
				scrollWheelZoom: full,
				// בתצוגה המקדימה לחיצה כפולה פותחת את המפה הגדולה במקום לזום:
				// במלבן של 165px זום פנימי כמעט ואינו קריא, והמסך המלא הוא
				// התשובה הנכונה לרצון "לראות מקרוב".
				doubleClickZoom: full,
				zoomSnap: 0.1
			}).setView([31.7, 35.0], 7);
			if (!full && onexpand) map.on('dblclick', () => onexpand());
			// "Leaflet | 🇺🇦" — הקרדיט לספריית המפה עצמה — אינו נדרש ברישיון, והוא
			// היה שני שלישים משורת הכיתוב. הקרדיט לנתונים (OSM ו-CARTO) כן נדרש,
			// ולכן הוא נשאר — מקוצר לשמות בלבד, עם קישור לנוסח המלא של כל אחד.
			map.attributionControl.setPrefix(false);
			// אריחי OSM הרגילים צורבים את השמות אל תוך התמונה, ובאזור שלנו הם
			// מגיעים בערבית לצד העברית — אין דרך לסנן שפה מאריח PNG מוכן. לכן
			// בסיס בלי שום כיתוב (Voyager no-labels), והשמות נכתבים מעליו
			// בעברית ב-renderLabels.
			L.tileLayer(
				'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png',
				{
					attribution:
						'<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OSM</a> · <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
					subdomains: 'abcd',
					maxZoom: 20
				}
			).addTo(map);
			// שכבה משלה לשמות היישובים, מתחת לעיגולים ולפינים (overlayPane הוא
			// 400): כך התוויות לא מכסות סימון של עסק, והן שקופות לעכבר לגמרי.
			map.createPane('cityLabels');
			map.getPane('cityLabels').style.zIndex = '350';
			map.getPane('cityLabels').style.pointerEvents = 'none';
			labelsLayer = L.layerGroup().addTo(map);
			map.on('zoomend', renderLabels);
			renderLabels();
			// featureGroup ולא layerGroup: רק לו יש getBounds, שממסגר גם עיגולים
			markersLayer = L.featureGroup().addTo(map);
			render();
		})();
	});

	onDestroy(() => map?.remove());

	// גם התוויות תלויות בסינון, לא רק בזום: יישוב מפסיק להיות "מרכז עיגול"
	// ברגע שהעסק שבו סונן החוצה
	$effect(() => {
		if (!map) return;
		render();
		renderLabels();
	});
</script>

<!-- isolate: כולא את ה-z-index הגבוהים של Leaflet (400–1000) בתוך stacking context משלו, שלא יצוירו מעל ההדר (z-50) -->
<div class="relative isolate {full ? 'h-full' : 'map-preview'}">
	<!-- מסגרת לאורך, בערך ביחס של הארץ עצמה: היא ארוכה מצפון לדרום וצרה
	     ממערב למזרח, ובמלבן רחב נותרו פסי ים ומדבר משני הצדדים בזמן שהיישובים
	     הצטופפו לפס דק באמצע. הגובה חייב להתאים לשלד ב-LazyMap, אחרת הדף קופץ
	     כשהמפה נטענת. במסך מלא הגובה מגיע מהשכבה שעוטפת. -->
	<div
		bind:this={mapEl}
		class="w-full rounded-xl {full ? 'h-full' : 'h-[215px] md:h-[430px]'}"
	></div>
	{#if !drawn}
		<div
			class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-gray-900/60 text-center text-xs text-gray-300"
		>
			<span class="max-w-xs px-4"
				>רוב העסקים ארציים / אונליין ואינם ממוקמים על המפה. חפשו אותם ברשימה למעלה.</span
			>
		</div>
	{/if}

	{#if !full && onexpand}
		<!-- z מעל 1000: הבקרים של Leaflet יושבים על 800–1000, ו-.leaflet-container
		     אינו stacking context משלו — ולכן z נמוך מזה היה נופל מתחתיהם. -->
		<button
			type="button"
			onclick={() => onexpand?.()}
			class="absolute top-2 right-2 z-[1200] rounded-lg border border-gray-300 bg-white/90 p-1.5 text-gray-700 shadow-md transition hover:bg-white"
			aria-label="הגדלת המפה למסך מלא"
			title="הגדלת המפה למסך מלא"
		>
			<svg
				class="h-4 w-4"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6" />
			</svg>
		</button>

		<!-- ה"זכוכית": שכבה שקופה מעל המפה בנייד. Leaflet קובע touch-action:none
		     על המכל שלו כדי לתפוס גרירה באצבע — וכך אצבע שנחתה על המפה בדרך
		     מטה בדף הזיזה את המפה במקום לגלול את האתר. הכפתור הזה הוא אלמנט
		     רגיל, ולכן הגלילה עליו היא גלילת הדף; והקשה עליו פותחת את המפה
		     במסך מלא, ששם הגרירה באצבע היא באמת מה שרוצים.
		     aria-hidden + tabindex=-1: אותה פעולה בדיוק כבר נמסרת בכפתור
		     ההגדלה שמעליו, ואין טעם למסור אותה פעמיים. -->
		<button
			type="button"
			onclick={() => onexpand?.()}
			class="absolute inset-0 z-[1100] cursor-pointer md:hidden"
			aria-hidden="true"
			tabindex="-1"
		></button>
	{/if}
	<!-- אין כאן הסתייגות "אזור משוער": מרגע שאין מעגלים אין גם אזור שצריך
	     לסייג, ונקודה על מרכז יישוב נקראת ממילא כמה שהיא. ההסתייגות המלאה
	     נשארת במפת העסק הבודד, שם באמת מצויר אזור. -->
</div>

<style>
	:global(.leaflet-popup-content) {
		margin: 10px 12px;
	}

	/* בלי איפוס מפורש, .leaflet-div-icon היה מצייר ריבוע לבן עם מסגרת מאחורי ה-SVG */
	:global(.biz-pin) {
		background: none;
		border: none;
		filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.45));
	}

	/* Leaflet קובע font-family משלו על המכל, ולכן כל טקסט במפה — תוויות,
	   תיאורים ופופאפים — נפל לגופן ברירת המחדל במקום ל-Heebo של האתר */
	:global(.leaflet-container) {
		font-family: inherit;
	}

	/* שורת הקרדיט בגודל ברירת המחדל (11px, ריפוד 3×5) נשברה לשתי שורות
	   במפה הצרה ותפסה פינה שלמה. הכיתוב נשאר קריא ולחיץ, אבל בגודל של
	   הערת שוליים ובלבן שקוף למחצה — כמו שהוא נראה בשאר המפות ברשת. */
	/* כפתורי ה-+/− בתצוגה המקדימה בנייד: הזכוכית שמעליהם חוסמת אותם ממילא,
	   והם גזלו פינה מתוך מלבן של 165px. במסך המלא הם חוזרים. */
	@media (max-width: 767px) {
		.map-preview :global(.leaflet-control-zoom) {
			display: none;
		}
	}

	:global(.leaflet-control-attribution) {
		padding: 0 4px;
		background: rgb(255 255 255 / 0.65);
		font-size: 9px;
		line-height: 14px;
		white-space: nowrap;
	}

	/* שם היישוב יושב ישירות על צילום הרקע, ובלי הילה לבנה הוא נבלע בכביש
	   או בשטח בנוי. text-shadow משוכפל כדי לעבות אותה. */
	:global(.city-label) {
		background: none;
		border: none;
		overflow: visible;
		white-space: nowrap;
		text-align: center;
		font-size: 11px;
		font-weight: 700;
		line-height: 16px;
		color: #1f2937;
		text-shadow:
			0 0 3px #fff,
			0 0 3px #fff,
			0 0 2px #fff;
	}

	/* היישוב שבמרכז העיגול — הוא התשובה, והשאר הם רקע להתמצאות. בכחול של
	   העיגול עצמו, כדי שהקשר בין השם לצורה ייקרא מיד. */
	:global(.city-label-key) {
		font-size: 13px;
		font-weight: 800;
		color: #1d4ed8;
		text-shadow:
			0 0 4px #fff,
			0 0 3px #fff,
			0 0 2px #fff;
	}
</style>
