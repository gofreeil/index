<script>
	import { fade } from 'svelte/transition';

	/** @type {{ salesArea?: string, address?: string, businesses?: any[] }} */
	let { salesArea = 'כל הארץ', address = '', businesses = [] } = $props();

	// Extended city mapping for markers and zoom
	const cityCoords = {
		ירושלים: { x: 105, y: 245 },
		'בני ברק': { x: 80, y: 165 },
		'תל אביב': { x: 78, y: 160 },
		אשדוד: { x: 65, y: 210 },
		'בית שמש': { x: 95, y: 235 },
		'ביתר עילית': { x: 102, y: 255 },
		'מודיעין עילית': { x: 98, y: 215 },
		חיפה: { x: 85, y: 70 },
		'פתח תקווה': { x: 85, y: 155 },
		נתניה: { x: 74, y: 115 },
		צפת: { x: 110, y: 35 },
		אלעד: { x: 88, y: 175 },
		רחובות: { x: 75, y: 185 },
		'באר שבע': { x: 75, y: 360 },
		אילת: { x: 90, y: 485 }
	};

	// Try to find the city in the address
	const detectedCity = $derived(
		Object.keys(cityCoords).find((city) => address?.includes(city)) || null
	);

	const markerPos = $derived(detectedCity ? cityCoords[detectedCity] : null);

	// All markers for the main page map
	const allMarkers = $derived(
		businesses
			.map((b) => {
				const city = Object.keys(cityCoords).find((c) => b.address?.includes(c));
				return city ? { ...cityCoords[city], name: b.name } : null;
			})
			.filter(Boolean)
	);

	// Keywords mapping to regions
	const regions = [
		{
			id: 'north',
			name: 'צפון',
			keywords: ['צפון', 'גליל', 'גולן', 'חיפה', 'קריות', 'טבריה', 'נהריה', 'עכו', 'צפת'],
			path: 'M95,10 L115,20 L125,50 L120,80 L110,100 L90,105 L70,80 L75,40 L85,15 Z'
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
			path: 'M110,100 L125,150 L120,220 L100,230 L80,220 L75,180 L85,130 L90,105 Z'
		},
		{
			id: 'jerusalem',
			name: 'ירושלים',
			keywords: ['ירושלים', 'בית שמש', 'מעלה אדומים', 'מבשרת', 'ביתר'],
			path: 'M100,230 L120,220 L130,250 L125,280 L110,290 L95,270 Z'
		},
		{
			id: 'south',
			name: 'דרום',
			keywords: ['דרום', 'באר שבע', 'נגב', 'אילת', 'אשדוד', 'אשקלון', 'שפלה', 'ערד', 'דימונה'],
			path: 'M95,270 L110,290 L120,350 L110,420 L90,480 L70,490 L50,450 L40,400 L55,350 L75,300 Z'
		},
		{
			id: 'js',
			name: 'יהודה ושומרון',
			keywords: ['יהודה ושומרון', 'יו"ש', 'אריאל', 'חברון', 'שומרון', 'מודיעין'],
			path: 'M120,150 L140,160 L145,200 L130,250 L120,220 Z'
		}
	];

	// City labels for the "photo" look
	const mainCities = [
		{ name: 'חיפה', x: 80, y: 70 },
		{ name: 'תל אביב', x: 68, y: 160 },
		{ name: 'ירושלים', x: 105, y: 245 },
		{ name: 'באר שבע', x: 75, y: 360 },
		{ name: 'אילת', x: 90, y: 485 }
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
		const targetY = 250 - markerPos.y * 1.3;
		return `transform: scale(1.3) translateY(${targetY}px); transform-origin: 50% ${markerPos.y}px;`;
	});
</script>

<div class="relative flex flex-col items-center overflow-hidden p-4">
	<div
		class="relative w-full max-w-[280px] overflow-hidden rounded-2xl border border-sky-100 bg-sky-50 shadow-inner"
	>
		<svg
			viewBox="0 0 200 500"
			class="h-[600px] w-auto transition-all duration-1000 ease-in-out"
			style={zoomStyles}
			xmlns="http://www.w3.org/2000/svg"
		>
			<!-- Sea -->
			<rect x="-100" y="0" width="400" height="500" fill="#f0f9ff" />

			<!-- Israel Land Base -->
			<g fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.5">
				{#each regions as region}
					<path d={region.path} />
				{/each}
			</g>

			<!-- Active Service Boundaries (Green Overlay) -->
			<g>
				{#each regions as region}
					{#if isActive(region.id)}
						<path
							in:fade={{ duration: 1000 }}
							d={region.path}
							fill="rgba(34, 197, 94, 0.25)"
							stroke="#16a34a"
							stroke-width="1"
						/>
					{/if}
				{/each}
			</g>

			<!-- Regional Labels Map-Style -->
			<g class="pointer-events-none opacity-40">
				{#each mainCities as city}
					<text
						x={city.x + 5}
						y={city.y + 2}
						font-size="6"
						font-weight="bold"
						fill="#94a3b8"
						style="font-family: sans-serif;"
					>
						{city.name}
					</text>
				{/each}
			</g>

			<!-- THEPIN: Business Location Marker (Single) -->
			{#if markerPos && businesses.length === 0}
				<g in:fade={{ delay: 1000, duration: 500 }}>
					<!-- Pulse effect -->
					<circle
						cx={markerPos.x}
						cy={markerPos.y}
						r="8"
						fill="#ef4444"
						class="animate-ping opacity-20"
					/>
					<!-- Pin shadow -->
					<ellipse cx={markerPos.x} cy={markerPos.y + 2} rx="2" ry="1" fill="black" opacity="0.2" />
					<!-- Actual Pin -->
					<path
						d="M{markerPos.x} {markerPos.y} l-4 -8 a4 4 0 1 1 8 0 z"
						fill="#ef4444"
						stroke="white"
						stroke-width="0.5"
					/>
					<circle cx={markerPos.x} cy={markerPos.y - 8} r="1.5" fill="white" />
				</g>
			{/if}

			<!-- Multi Markers for Main Page -->
			{#if businesses.length > 0}
				<g>
					{#each allMarkers as marker}
						<g>
							<circle
								cx={marker.x}
								cy={marker.y}
								r="3"
								fill="#ef4444"
								stroke="white"
								stroke-width="0.5"
							/>
							<title>{marker.name}</title>
						</g>
					{/each}
				</g>
			{/if}
		</svg>

		<!-- Zoom reset / Legend indicator -->
		<div
			class="pointer-events-none absolute right-4 bottom-4 left-4 flex items-end justify-between"
		>
			<div
				class="rounded-lg border border-gray-100 bg-white/90 p-2 text-[10px] font-bold shadow-sm backdrop-blur-sm"
			>
				<div class="mb-1 flex items-center gap-1.5">
					<div class="h-2 w-2 rounded-full bg-red-500"></div>
					<span class="text-gray-700">מיקום העסק</span>
				</div>
				<div class="flex items-center gap-1.5">
					<div class="h-2 w-2 rounded-sm border border-green-500/20 bg-green-500/40"></div>
					<span class="text-gray-700">אזורי שירות</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Status Message -->
	{#if detectedCity}
		<p class="animate-fade-in font-display mt-4 text-center text-xs font-medium text-blue-600">
			📍 מוצג מיקום מקורב ב{detectedCity}
		</p>
	{/if}

	<!-- legend and regions list -->
	<div class="mt-6 flex flex-wrap justify-center gap-3">
		{#each regions as region}
			<div
				class="flex items-center gap-2 rounded-full border px-3 py-1.5 transition-all {isActive(
					region.id
				)
					? 'border-green-200 bg-green-50 text-green-700 shadow-sm'
					: 'border-gray-100 bg-white text-gray-400 opacity-60'}"
			>
				<div
					class="h-2 w-2 rounded-full {isActive(region.id) ? 'bg-green-500' : 'bg-gray-200'}"
				></div>
				<span class="text-xs leading-none font-bold">
					{region.name}
				</span>
			</div>
		{/each}
	</div>
</div>

<style>
	svg {
		filter: drop-shadow(0 4px 6px -1px rgb(0 0 0 / 0.1));
	}
</style>
