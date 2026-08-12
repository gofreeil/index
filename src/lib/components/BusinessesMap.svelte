<script>
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolveServiceArea, serviceShapes } from '$lib/serviceArea.js';
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

	// אזור העבודה נגזר מ"אזור מכירה" — טקסט חופשי — ולכן מצויר כעיגול מקורב
	// ולא כגבול. עסק ארצי, וגם מי שלא ניתן היה לגזור ממנו מקום, מסומן ככל
	// הארץ; כולם חולקים מתאר אחד ולא נערמים זה על זה.
	const areas = $derived(businesses.map((b) => ({ b, area: resolveServiceArea(b) })));

	/* כמה עסקים באותו יישוב = אותה צורה בדיוק. מיזוג לצורה אחת מונע ערימת
	   שכבות שמכהה את המפה, ומאפשר פופאפ שמונה את כולם במקום להסתיר את התחתונים. */
	const shapes = $derived.by(() => {
		/** @type {Record<string, any>} */
		const groups = {};
		for (const { b, area } of areas) {
			for (const s of serviceShapes(area)) {
				groups[s.key] ??= { ...s, items: [] };
				groups[s.key].items.push(b);
			}
		}
		// הגדולים נכנסים ראשונים, כדי שצורה קטנה שיושבת בתוכם תישאר לחיצה
		const size = (/** @type {any} */ s) =>
			s.type === 'country' ? Number.MAX_SAFE_INTEGER : s.radius;
		return Object.values(groups).sort((a, b) => size(b) - size(a));
	});

	const drawn = $derived(mapped.length > 0 || shapes.length > 0);

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
		sub.textContent = `${group.items.length} עסקים · אזור מקורב`;
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

	function render() {
		if (!map || !L || !markersLayer) return;
		markersLayer.clearLayers();

		for (const g of shapes) {
			// עיגול "כל הארץ" שוכב מתחת לכולם וכמעט שקוף, אחרת העיגולים
			// המקומיים היו נבלעים בתוכו
			const faint = g.type === 'country';
			const base = {
				color: '#2563eb',
				weight: faint ? 1 : 1.5,
				opacity: faint ? 0.3 : 0.5,
				fillColor: '#3b82f6',
				fillOpacity: faint ? 0.04 : 0.1,
				dashArray: faint ? '6 5' : undefined
			};
			const shape = L.circle([g.lat, g.lng], { ...base, radius: g.radius });
			shape.addTo(markersLayer);
			shape.bindPopup(areaPopup(g));
			shape.bindTooltip(`${g.label} · ${g.items.length} עסקים`, { direction: 'top' });
			shape.on('mouseover', () =>
				shape.setStyle({ fillOpacity: faint ? 0.1 : 0.22, opacity: 0.85 })
			);
			shape.on('mouseout', () => shape.setStyle(base));
		}

		for (const b of mapped) {
			const marker = L.marker([b.lat, b.lng], { icon: pinIcon, riseOnHover: true }).addTo(
				markersLayer
			);
			marker.bindPopup(markerPopup(b));
			marker.bindTooltip(b.name || '', { direction: 'top' });
		}

		const bounds = markersLayer.getBounds();
		if (bounds?.isValid()) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
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
			// featureGroup ולא layerGroup: רק לו יש getBounds, שממסגר גם עיגולים
			markersLayer = L.featureGroup().addTo(map);
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
	{#if !drawn}
		<div
			class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-gray-900/60 text-center text-xs text-gray-300"
		>
			<span class="max-w-xs px-4"
				>רוב העסקים ארציים / אונליין ואינם ממוקמים על המפה. חפשו אותם ברשימה למעלה.</span
			>
		</div>
	{/if}
</div>

<!-- הגובה קבוע (שתי שורות בנייד, אחת מ-sm) ומשוכפל בשלד של LazyMap, אחרת
     הדף קופץ כשהמפה מחליפה את השלד. לכן הפסקה מרונדרת תמיד, גם כשריקה. -->
<p class="mt-1.5 h-8 px-1 text-center text-[11px] leading-4 text-gray-500 sm:h-4">
	{#if drawn}
		אזור עבודה מקורב לפי הכרטיסייה, לא גבול מדויק. מי שלא ציין אזור מסומן ככל הארץ.
	{/if}
</p>

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
