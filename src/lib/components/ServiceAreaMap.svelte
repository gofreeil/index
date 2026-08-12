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
	import { resolveServiceArea, serviceShapes } from '$lib/serviceArea.js';
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
			// בסיס בלי כיתוב, כמו במפה הראשית: אריחי OSM הרגילים צורבים לתוך
			// התמונה שמות בערבית לצד העברית, ואי אפשר לסנן שפה מ-PNG מוכן.
			L.tileLayer(
				'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png',
				{
					attribution: '&copy; OpenStreetMap &copy; CARTO',
					subdomains: 'abcd',
					maxZoom: 20
				}
			).addTo(map);
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
<div bind:this={holder} class="relative isolate">
	{#if show}
		<div bind:this={mapEl} class="w-full rounded-xl {height}"></div>
	{:else}
		<div class="w-full animate-pulse rounded-xl bg-gray-800 {height}"></div>
	{/if}
</div>

<style>
	:global(.area-pin) {
		background: none;
		border: none;
		filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.45));
	}
</style>
