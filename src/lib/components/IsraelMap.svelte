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

	const isAllCountry = $derived(
		!salesArea || salesArea.includes('כל הארץ') || salesArea === 'ארצי'
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
	<svg
		viewBox="0 0 200 500"
		class="h-[500px] w-auto drop-shadow-2xl"
		xmlns="http://www.w3.org/2000/svg"
	>
		<!-- Background / Ghost map -->
		<g fill="#E2E8F0" stroke="#CBD5E1" stroke-width="1">
			{#each regions as region}
				<path d={region.path} />
			{/each}
		</g>

		<!-- Highlighted Regions -->
		<g>
			{#each regions as region}
				{#if isActive(region.id)}
					<path
						in:fade={{ duration: 800 }}
						d={region.path}
						fill="rgba(59, 130, 246, 0.4)"
						stroke="#3b82f6"
						stroke-width="2"
						class="transition-all duration-500 hover:fill-blue-400/50"
					>
						<title>{region.name}</title>
					</path>
				{/if}
			{/each}
		</g>
	</svg>

	<div class="mt-4 flex flex-wrap justify-center gap-2">
		{#each regions as region}
			<span
				class="rounded-full px-3 py-1 text-xs font-medium transition-colors {isActive(region.id)
					? 'bg-blue-100 text-blue-700'
					: 'bg-gray-100 text-gray-400'}"
			>
				{region.name}
			</span>
		{/each}
	</div>
</div>
