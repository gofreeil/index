<script>
	// ============================================================
	// אזור העבודה של כרטיסייה אחת — למפה שבדף העסק.
	//
	// המפה של גוגל שלצידה עונה על "איפה העסק יושב" והיא מוצאת כתובת מטקסט
	// חופשי; היא לא יכולה לצייר עליה דבר (iframe סגור). המפה הזאת עונה על
	// השאלה השנייה — "לאן הוא מגיע" — ולכן שתיהן חיות זו לצד זו.
	//
	// Leaflet נטען רק כשהמפה מתקרבת למסך: לרוב הגולשים בדף העסק היא נמצאת
	// מתחת לקיפול, ואין סיבה לשלם עליה בטעינה הראשונה.
	// ============================================================
	import { onDestroy } from 'svelte';
	import { cityLabels, resolveServiceArea, serviceShapes } from '$lib/serviceArea.js';
	import { BASEMAP_URL, BASEMAP_OPTIONS } from '$lib/basemap.js';
	import 'leaflet/dist/leaflet.css';

	/** @type {{ business: any, height?: string }} */
	let { business, height = 'h-72 sm:h-[26rem]' } = $props();

	/** @type {HTMLDivElement} */
	let holder;
	// $state: ה-div נוצר רק אחרי ש-show הופך ל-true, ולכן ה-effect שבונה את
	// המפה חייב להתעורר מחדש ברגע ש-bind:this מציב אותו
	/** @type {HTMLDivElement | undefined} */
	let mapEl = $state();
	/** @type {any} */
	let map;
	/** @type {any} */
	let L;
	let show = $state(false);

	const area = $derived(resolveServiceArea(business));
	const shapes = $derived(serviceShapes(area));
	const hasPin = $derived(typeof business?.lat === 'number' && typeof business?.lng === 'number');
	/* אין צורה ואין נקודה = אין מפה. מפה בלי שום ציור עליה היא תצוגת כל
	   הארץ, והמבקר קורא אותה כ"העסק מגיע לכל מקום" — טענה שלא נמסרה. */
	const drawable = $derived(shapes.length > 0 || hasPin);

	const PIN_SVG = `<svg viewBox="0 0 24 34" width="22" height="31" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 .9C6 .9 1.1 5.8 1.1 11.8c0 8.3 9.9 20.4 10.3 20.9a.8.8 0 0 0 1.2 0c.4-.5 10.3-12.6 10.3-20.9C22.9 5.8 18 .9 12 .9Z" fill="#2563eb" stroke="#fff" stroke-width="1.7"/><circle cx="12" cy="11.9" r="4.1" fill="#fff"/></svg>`;

	$effect(() => {
		// IntersectionObserver ולא onMount: הטעינה מתרחשת בגלילה אל המפה
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) if (e.isIntersecting) show = true;
			},
			{ rootMargin: '200px' }
		);
		if (holder) io.observe(holder);
		return () => io.disconnect();
	});

	$effect(() => {
		if (!show || !mapEl || map) return;
		let dead = false;
		(async () => {
			const mod = (await import('leaflet')).default;
			if (dead) return;
			L = mod;
			map = L.map(mapEl, { scrollWheelZoom: false }).setView([31.5, 35.0], 7);
			// הקרדיט לספריית Leaflet אינו נדרש ברישיון והוא תפס את רוב השורה;
			// הקרדיט לנתונים נשאר. השורה עוברת לפינה השמאלית, מפַנה את הימנית
			// להסתייגות.
			map.attributionControl.setPrefix(false);
			map.attributionControl.setPosition('bottomleft');
			// בסיס בלי כיתוב, כמו במפה הראשית (למה — ראו basemap.js).
			L.tileLayer(BASEMAP_URL, {
				...BASEMAP_OPTIONS,
				attribution: '&copy; OpenStreetMap &copy; CARTO'
			}).addTo(map);

			/* שמות היישובים בעברית, מצוירים על ידינו מעל בסיס חסר הכיתוב.
			   pane נפרד מתחת ל-overlayPane (400), כדי שהתוויות לא יכסו את
			   העיגולים ואת הפין, ולא ייקחו לחיצות. הרשימה תלוית זום, ומרכזי
			   העיגולים — היישובים שהעסק הזה עובד בהם — נכתבים בכל זום ובולט. */
			map.createPane('cityLabels');
			map.getPane('cityLabels').style.zIndex = '350';
			map.getPane('cityLabels').style.pointerEvents = 'none';
			const labels = L.layerGroup().addTo(map);
			const featured = new Set(shapes.filter((s) => s.type === 'circle').map((s) => s.label));
			const drawLabels = () => {
				labels.clearLayers();
				// הרוחב מוערך מאורך השם, ותווית שמתנגשת באחת שכבר הונחה נושרת
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
						icon: L.divIcon({
							html: el,
							className: c.featured ? 'city-label city-label-key' : 'city-label',
							iconSize: [120, 16],
							iconAnchor: [60, -3]
						}),
						pane: 'cityLabels',
						interactive: false,
						keyboard: false
					}).addTo(labels);
				}
			};
			map.on('zoomend', drawLabels);
			drawLabels();

			const layer = L.featureGroup().addTo(map);

			for (const s of shapes) {
				const faint = s.type === 'country';
				const style = {
					color: '#2563eb',
					weight: faint ? 1 : 2,
					opacity: faint ? 0.35 : 0.7,
					fillColor: '#3b82f6',
					fillOpacity: faint ? 0.05 : 0.15,
					dashArray: faint ? '6 5' : undefined
				};
				L.circle([s.lat, s.lng], { ...style, radius: s.radius })
					.addTo(layer)
					.bindTooltip(s.label, { direction: 'top' });
			}

			if (hasPin) {
				L.marker([business.lat, business.lng], {
					icon: L.divIcon({
						html: PIN_SVG,
						className: 'area-pin',
						iconSize: [22, 31],
						iconAnchor: [11, 31],
						tooltipAnchor: [0, -30]
					})
				})
					.addTo(layer)
					.bindTooltip(business.name || '', { direction: 'top' });
			}

			const bounds = layer.getBounds();
			if (bounds?.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 12 });
		})();
		return () => {
			dead = true;
		};
	});

	onDestroy(() => map?.remove());
</script>

<!-- isolate: כולא את ה-z-index הגבוהים של Leaflet בתוך stacking context משלו -->
{#if drawable}
	<div bind:this={holder} class="relative isolate">
		{#if show}
			<div bind:this={mapEl} class="w-full rounded-xl {height}"></div>
			<!-- ההסתייגות בתוך המפה ולא מתחתיה, שלא תגזול שורה בכרטיסייה. בכחול
			     של העיגולים ולא בשחור, ובריחוק מהפינה כדי שלא תיראה מודבקת לשוליים.
			     שורת הייחוס יורדת לפינה השמאלית כדי שהשתיים לא ייפגשו.
			     z גבוה מפקדי Leaflet. -->
			<div
				class="pointer-events-none absolute right-2 bottom-2 z-[1000] rounded bg-blue-600/90 px-2 py-0.5 text-[10px] leading-4 font-medium text-white"
			>
				אזורי השירות להמחשה בלבד
			</div>
		{:else}
			<div class="w-full animate-pulse rounded-xl bg-gray-800 {height}"></div>
		{/if}
	</div>
{/if}

<style>
	:global(.area-pin) {
		background: none;
		border: none;
		filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.45));
	}

	/* משוכפל מ-BusinessesMap: לדף העסק נטענת רק המפה הזאת, וסגנון של רכיב
	   אחר אינו נטען איתה. Leaflet קובע גופן משלו על המכל, וההילה הלבנה היא
	   מה שמפריד את השם מהרקע שמתחתיו. */
	:global(.leaflet-container) {
		font-family: inherit;
	}

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

	/* היישוב שבמרכז העיגול — האזור שהעסק הזה עובד בו, ולא רקע להתמצאות */
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
