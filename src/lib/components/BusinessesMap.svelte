<script>
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import 'leaflet/dist/leaflet.css';

	/** @type {{ businesses: any[] }} */
	let { businesses = [] } = $props();

	/** @type {HTMLDivElement} */
	let mapEl;
	/** @type {any} */
	let map;
	/** @type {any} */
	let markersLayer;
	/** @type {any} */
	let L;

	// רק עסקים עם קואורדינטות אמיתיות (lat/lng) מקבלים פין. עסקים ארציים/אונליין
	// בלי מיקום — לא מוצגים על המפה (סוף הפינים המזויפים מ-Math.random).
	const mapped = $derived(
		businesses.filter((b) => typeof b.lat === 'number' && typeof b.lng === 'number')
	);

	function render() {
		if (!map || !L || !markersLayer) return;
		markersLayer.clearLayers();
		const bounds = [];
		for (const b of mapped) {
			const marker = L.marker([b.lat, b.lng]).addTo(markersLayer);

			// popup נבנה מ-DOM nodes עם textContent — לא string concat (חסין XSS).
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
			const a = document.createElement('a');
			a.textContent = 'מעבר לעסק »';
			a.href = `/business/${b.documentId}`;
			a.style.cssText =
				'display:inline-block;margin-top:8px;padding:5px 12px;background:#2563eb;color:#fff;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none';
			a.addEventListener('click', (e) => {
				e.preventDefault();
				goto(a.getAttribute('href') || '/');
			});
			box.appendChild(a);

			marker.bindPopup(box);
			marker.bindTooltip(b.name || '', { direction: 'top' });
			bounds.push([b.lat, b.lng]);
		}
		if (bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
	}

	onMount(() => {
		(async () => {
			L = (await import('leaflet')).default;
			map = L.map(mapEl, { scrollWheelZoom: false }).setView([31.5, 35.0], 8);
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '&copy; OpenStreetMap',
				maxZoom: 18
			}).addTo(map);
			markersLayer = L.layerGroup().addTo(map);
			render();
		})();
	});

	onDestroy(() => map?.remove());

	$effect(() => {
		if (map) render();
	});
</script>

<!-- isolate: כולא את ה-z-index הגבוהים של Leaflet (400–1000) בתוך stacking context משלו, שלא יצוירו מעל ההדר (z-50) -->
<div class="relative isolate">
	<!-- הגובה חייב להתאים לשלד ב-LazyMap, אחרת הדף קופץ כשהמפה נטענת -->
	<div bind:this={mapEl} class="h-[190px] w-full rounded-xl sm:h-[240px]"></div>
	{#if mapped.length === 0}
		<div
			class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-gray-900/60 text-center text-xs text-gray-300"
		>
			<span class="max-w-xs px-4"
				>רוב העסקים ארציים / אונליין ואינם ממוקמים על המפה. חפשו אותם ברשימה למעלה.</span
			>
		</div>
	{/if}
</div>

<style>
	:global(.leaflet-popup-content) {
		margin: 10px 12px;
	}
</style>
