<script>
	import { fade } from 'svelte/transition';

	/** @type {{ salesArea: string }} */
	let { salesArea = 'כל הארץ' } = $props();

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
				'פתח תקווה'
			],
			path: 'M110,100 L125,150 L120,220 L100,230 L80,220 L75,180 L85,130 L90,105 Z'
		},
		{
			id: 'jerusalem',
			name: 'ירושלים',
			keywords: ['ירושלים', 'בית שמש', 'מעלה אדומים', 'מבשרת'],
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
			keywords: ['יהודה ושומרון', 'יו"ש', 'אריאל', 'חברון', 'שומרון'],
			path: 'M120,150 L140,160 L145,200 L130,250 L120,220 Z'
		}
	];

	// City markers for more context
	const cities = [
		{ name: 'חיפה', x: 85, y: 70 },
		{ name: 'תל אביב', x: 78, y: 160 },
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
</script>

<div class="relative flex flex-col items-center p-4">
	<div class="relative overflow-hidden rounded-2xl bg-slate-50 shadow-inner">
		<svg
			viewBox="0 0 200 500"
			class="h-[600px] w-auto transition-all duration-700"
			xmlns="http://www.w3.org/2000/svg"
		>
			<!-- Sea/Background -->
			<rect width="200" height="500" fill="#f0f9ff" />

			<!-- Background / Ghost map base -->
			<g fill="#f1f5f9" stroke="#cbd5e1" stroke-width="0.5">
				{#each regions as region}
					<path d={region.path} class="transition-colors duration-300" />
				{/each}
			</g>

			<!-- Highlighted Service Regions -->
			<g>
				{#each regions as region}
					{#if isActive(region.id)}
						<path
							in:fade={{ duration: 1000 }}
							d={region.path}
							fill="rgba(34, 197, 94, 0.3)"
							stroke="#16a34a"
							stroke-width="1.5"
							class="transition-all duration-500 hover:fill-green-400/40"
						>
							<title>{region.name} - אזור שירות פעיל</title>
						</path>
					{/if}
				{/each}
			</g>

			<!-- City Markers -->
			<g class="pointer-events-none">
				{#each cities as city}
					<circle cx={city.x} cy={city.y} r="2.5" fill="#ef4444" />
					<text
						x={city.x + 4}
						y={city.y + 2}
						font-size="8"
						font-weight="bold"
						fill="#475569"
						style="font-family: sans-serif;"
					>
						{city.name}
					</text>
				{/each}
			</g>

			<!-- Compass -->
			<g transform="translate(20, 20) scale(0.5)" opacity="0.3">
				<circle r="20" fill="none" stroke="#64748b" stroke-width="1" />
				<path d="M0,-18 L4,0 L0,18 L-4,0 Z" fill="#64748b" />
				<path d="M-18,0 L0,-4 L18,0 L0,4 Z" fill="#64748b" />
			</g>
		</svg>
	</div>

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
