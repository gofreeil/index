<script>
	import { fade } from 'svelte/transition';

	/** @type {{ salesArea?: string, address?: string, businesses?: any[], showRegions?: boolean }} */
	let { salesArea = 'כל הארץ', address = '', businesses = [], showRegions = true } = $props();

	/** @type {Record<string, { x: number, y: number }>} */
	const cityCoords = {
		ירושלים: { x: 135, y: 245 },
		'בני ברק': { x: 110, y: 165 },
		'תל אביב': { x: 108, y: 160 },
		אשדוד: { x: 95, y: 210 },
		'בית שמש': { x: 125, y: 235 },
		'ביתר עילית': { x: 132, y: 255 },
		'מודיעין עילית': { x: 128, y: 215 },
		חיפה: { x: 115, y: 70 },
		'פתח תקווה': { x: 115, y: 155 },
		נתניה: { x: 104, y: 115 },
		צפת: { x: 140, y: 35 },
		אלעד: { x: 118, y: 175 },
		רחובות: { x: 105, y: 185 },
		'באר שבע': { x: 105, y: 360 },
		אילת: { x: 120, y: 485 },
		חולון: { x: 106, y: 172 },
		'ראשון לציון': { x: 104, y: 178 },
		הרצליה: { x: 105, y: 152 },
		'בת ים': { x: 103, y: 168 },
		'רמת גן': { x: 112, y: 162 },
		רעננה: { x: 110, y: 148 },
		'כפר סבא': { x: 115, y: 145 },
		חדרה: { x: 108, y: 105 },
		'קריית שמונה': { x: 145, y: 15 },
		נצרת: { x: 130, y: 80 },
		עכו: { x: 112, y: 55 },
		נהריה: { x: 114, y: 40 },
		טבריה: { x: 145, y: 75 },
		רמלה: { x: 115, y: 195 },
		לוד: { x: 120, y: 192 },
		מודיעין: { x: 130, y: 205 },
		אשקלון: { x: 85, y: 240 },
		'קרית מלאכי': { x: 105, y: 230 },
		נתיבות: { x: 80, y: 320 },
		שדרות: { x: 85, y: 300 },
		ערד: { x: 145, y: 340 },
		דימונה: { x: 135, y: 380 },
		חריש: { x: 115, y: 100 },
		עמנואל: { x: 135, y: 160 },
		'נוף הגליל': { x: 135, y: 80 },
		כרמיאל: { x: 130, y: 45 },
		מגדל: { x: 140, y: 70 },
		'קרית גת': { x: 95, y: 250 },
		רכסים: { x: 120, y: 65 }
	};

	// Try to find the city in the address
	const detectedCity = $derived(
		Object.keys(cityCoords).find((city) => address?.includes(city)) || null
	);

	const markerPos = $derived(detectedCity ? cityCoords[detectedCity] : null);

	// All markers for the main page map with Jitter to prevent overlap
	const allMarkers = $derived.by(() => {
		/** @type {Record<string, number>} */
		const cityCounts = {};

		return /** @type {any[]} */ (businesses).reduce((/** @type {any[]} */ acc, b) => {
			const addressStr = String(b.address || '');
			const salesAreaStr = String(b.salesArea || '');

			// Match the longest city name first for accuracy
			const cities = Object.keys(cityCoords).sort((a, b) => b.length - a.length);
			const city = cities.find((c) => addressStr.includes(c) || salesAreaStr.includes(c));

			if (city) {
				cityCounts[city] = (cityCounts[city] || 0) + 1;
				const count = cityCounts[city];

				// Spiral dispersion (Fermat's spiral concept)
				const angle = (count - 1) * 137.5; // Golden angle for even distribution
				const radius = count === 1 ? 0 : Math.min((count - 1) * 2.5, 15);
				const offsetX = Math.cos((angle * Math.PI) / 180) * radius;
				const offsetY = Math.sin((angle * Math.PI) / 180) * radius;

				acc.push({
					x: cityCoords[city].x + offsetX,
					y: cityCoords[city].y + offsetY,
					name: b.name
				});
			}
			return acc;
		}, []);
	});

	// Keywords mapping to regions
	const regions = [
		{
			id: 'north',
			name: 'צפון',
			keywords: ['צפון', 'גליל', 'גולן', 'חיפה', 'קריות', 'טבריה', 'נהריה', 'עכו', 'צפת'],
			path: 'M125,10 L145,20 L155,50 L150,80 L140,100 L120,105 L100,80 L105,40 L115,15 Z'
		},
		{
			id: 'center',
			name: 'מרכז',
			keywords: [
				'מרכז',
				'תל אביב',
				'גוש דן',
				'שרון',
				'נתניה',
				'חולון',
				'בת ים',
				'ראשון לציון',
				'רמת גן',
				'פתח תקווה',
				'בני ברק',
				'אלעד'
			],
			path: 'M140,100 L155,150 L150,220 L130,230 L110,220 L105,180 L115,130 L120,105 Z'
		},
		{
			id: 'jerusalem',
			name: 'ירושלים',
			keywords: ['ירושלים', 'בית שמש', 'מעלה אדומים', 'מבשרת', 'ביתר'],
			path: 'M130,230 L150,220 L160,250 L155,280 L140,290 L125,270 Z'
		},
		{
			id: 'south',
			name: 'דרום',
			keywords: ['דרום', 'באר שבע', 'נגב', 'אילת', 'אשדוד', 'אשקלון', 'שפלה', 'ערד', 'דימונה'],
			path: 'M125,270 L140,290 L150,350 L140,420 L120,480 L100,490 L80,450 L70,400 L85,350 L105,300 Z'
		},
		{
			id: 'js',
			name: 'יהודה ושומרון',
			keywords: ['יהודה ושומרון', 'יו"ש', 'אריאל', 'חברון', 'שומרון', 'מודיעין'],
			path: 'M150,150 L170,160 L175,200 L160,250 L140,220 Z'
		}
	];

	const isAllCountry = $derived(
		!salesArea ||
			salesArea.includes('כל הארץ') ||
			salesArea === 'ארצי' ||
			salesArea.includes('ארצי')
	);

	const activeRegions = $derived(
		regions.filter((region) => {
			if (isAllCountry) return true;
			const areaLower = salesArea.toLowerCase();
			return region.keywords.some((keyword) => areaLower.includes(keyword));
		})
	);

	/** @param {string} regionId */
	const isActive = (regionId) => activeRegions.some((r) => r.id === regionId);

	// Zoom calculation: focus on marker if exists, otherwise center on active regions
	const zoomStyles = $derived.by(() => {
		if (businesses.length > 0) return 'transform: scale(1) translateY(0);'; // No zoom for multi-map
		if (!markerPos) return 'transform: scale(1) translateY(0);';
		// Target Y: move the marker towards the middle of the view (which is 250 in a 500 height svg)
		const targetY = 250 - markerPos.y * 1.5;
		return `transform: scale(1.5) translateY(${targetY}px); transform-origin: 50% ${markerPos.y}px;`;
	});
</script>

<div class="relative flex flex-col items-center overflow-hidden p-2">
	<div
		class="relative h-[600px] w-full max-w-sm overflow-hidden rounded-3xl border-4 border-white bg-sky-50 shadow-2xl sm:h-[650px]"
	>
		<!-- Real Map Image from User -->
		<div class="absolute inset-0 transition-all duration-1000 ease-in-out" style={zoomStyles}>
			<img
				src="/israel-map.png"
				alt="Israel Map Background"
				class="h-full w-full object-fill opacity-90"
			/>

			<!-- SVG Overlay for Interactive Elements -->
			<svg
				viewBox="0 0 200 500"
				preserveAspectRatio="none"
				class="absolute inset-0 h-full w-full"
				xmlns="http://www.w3.org/2000/svg"
			>
				<!-- Active Service Boundaries (Semi-transparent Green Overlays) -->
				{#if showRegions && businesses.length === 0}
					<g>
						{#each regions as region}
							{#if isActive(region.id)}
								<path
									in:fade={{ duration: 1000 }}
									d={region.path}
									fill="rgba(34, 197, 94, 0.25)"
									stroke="#16a34a"
									stroke-width="1.5"
									stroke-dasharray="4 2"
								/>
							{/if}
						{/each}
					</g>
				{/if}

				<!-- THEPIN: Business Location Marker (Single) -->
				{#if markerPos && businesses.length === 0}
					<g in:fade={{ delay: 1000, duration: 500 }}>
						<circle
							cx={markerPos.x}
							cy={markerPos.y}
							r="10"
							fill="#ef4444"
							class="animate-ping opacity-30"
						/>
						<path
							d="M{markerPos.x} {markerPos.y} l-5 -10 a5 5 0 1 1 10 0 z"
							fill="#ef4444"
							stroke="white"
							stroke-width="1"
						/>
						<circle cx={markerPos.x} cy={markerPos.y - 10} r="2" fill="white" />
					</g>
				{/if}

				<!-- Multi Markers for Main Page -->
				{#if businesses.length > 0}
					<g>
						{#each allMarkers as marker}
							<g>
								<!-- Outer glow/halo -->
								<circle cx={marker.x} cy={marker.y} r="7" fill="white" class="opacity-40" />
								<!-- Inner marker -->
								<circle
									cx={marker.x}
									cy={marker.y}
									r="4.5"
									fill="#ef4444"
									stroke="white"
									stroke-width="1.5"
									class="shadow-xl"
								/>
								<title>{marker.name}</title>
							</g>
						{/each}
					</g>
				{/if}
			</svg>
		</div>

		<!-- Zoom reset / Legend indicator -->
		<div class="pointer-events-none absolute right-4 bottom-4 left-4 flex flex-col gap-2">
			<div
				class="rounded-xl border border-white/50 bg-white/80 p-3 text-[11px] font-bold shadow-lg backdrop-blur-md"
			>
				<div class="mb-1.5 flex items-center gap-2">
					<div class="h-3 w-3 rounded-full bg-red-500 shadow-sm"></div>
					<span class="text-gray-800">מיקום בעסק</span>
				</div>
				{#if showRegions && businesses.length === 0}
					<div class="flex items-center gap-2">
						<div
							class="h-3 w-3 rounded-sm border border-green-500/30 bg-green-500/40 shadow-sm"
						></div>
						<span class="text-gray-800">אזורי שירות פעילים</span>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Status Message -->
	{#if detectedCity}
		<div
			class="mt-4 flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 shadow-sm"
		>
			<span class="text-xs font-bold text-blue-700">📍 נמצא ב{detectedCity}</span>
		</div>
	{/if}

	<!-- legend and regions list -->
	{#if showRegions && businesses.length === 0}
		<div class="mt-8 flex flex-wrap justify-center gap-2">
			{#each regions as region}
				<div
					class="flex items-center gap-2 rounded-full border px-4 py-2 transition-all duration-300 {isActive(
						region.id
					)
						? 'scale-105 transform border-green-200 bg-green-50 text-green-800 shadow-md'
						: 'border-gray-100 bg-white text-gray-400 opacity-60'}"
				>
					<div
						class="h-2.5 w-2.5 rounded-full {isActive(region.id)
							? 'animate-pulse bg-green-500'
							: 'bg-gray-200'}"
					></div>
					<span class="text-xs leading-none font-extrabold">
						{region.name}
					</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	img {
		filter: brightness(1.05) contrast(1.05);
	}
	@keyframes ping {
		75%,
		100% {
			transform: scale(2.5);
			opacity: 0;
		}
	}
	.animate-ping {
		animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
		transform-origin: center;
	}
</style>
