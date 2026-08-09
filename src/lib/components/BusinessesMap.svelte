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
	/** @type {any} */
	let pinIcon;

	// האייקון הדיפולטי של Leaflet מושך קובצי PNG מ-leaflet/dist/images לפי נתיב
	// שהוא מנחש מה-CSS — נתיב ש-Vite לא מגיש, ולכן במקום פינים הופיעו ריבועי
	// "תמונה שבורה". פין SVG inline מבטל את התלות: אפס בקשות רשת, חד בכל צפיפות
	// מסך, ובצבע של הכפתור בפופאפ.
	const PIN_SVG = `<svg viewBox="0 0 24 34" width="22" height="31" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 .9C6 .9 1.1 5.8 1.1 11.8c0 8.3 9.9 20.4 10.3 20.9a.8.8 0 0 0 1.2 0c.4-.5 10.3-12.6 10.3-20.9C22.9 5.8 18 .9 12 .9Z" fill="#2563eb" stroke="#fff" stroke-width="1.7"/><circle cx="12" cy="11.9" r="4.1" fill="#fff"/></svg>`;

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
			const marker = L.marker([b.lat, b.lng], { icon: pinIcon, riseOnHover: true }).addTo(
				markersLayer
			);

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
			// iconAnchor בקצה התחתון של הפין — כך החוד יושב בדיוק על הקואורדינטה;
			// ה-anchors השליליים מרימים את הפופאפ והתיאור אל מעל ראש הפין.
			pinIcon = L.divIcon({
				html: PIN_SVG,
				className: 'biz-pin',
				iconSize: [22, 31],
				iconAnchor: [11, 31],
				popupAnchor: [0, -30],
				tooltipAnchor: [0, -30]
			});
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

	/* בלי איפוס מפורש, .leaflet-div-icon היה מצייר ריבוע לבן עם מסגרת מאחורי ה-SVG */
	:global(.biz-pin) {
		background: none;
		border: none;
		filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.45));
	}
</style>
