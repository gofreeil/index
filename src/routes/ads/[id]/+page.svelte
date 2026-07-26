<script>
	// דף הנחיתה של פרסומת — פורט מ-community/my_new_project/src/routes/ads/[id].
	/** @type {{ data: any }} */
	let { data } = $props();

	const ad = $derived(data.ad);
	const lp = $derived(ad.landing ?? {});
</script>

<svelte:head>
	<title>{ad.title} — מדריך בעלי מקצוע</title>
	<meta name="description" content={ad.subtitle || ad.title} />
</svelte:head>

<div class="min-h-screen text-white" dir="rtl">
	<header class="relative bg-gradient-to-br {ad.gradient} px-4 py-12 text-center md:py-20">
		{#if ad.logo}
			<img
				src={ad.logo}
				alt=""
				class="mx-auto mb-4 h-20 w-20 rounded-2xl bg-white/10 object-contain p-2"
			/>
		{/if}
		<h1 class="mb-2 text-3xl font-black drop-shadow md:text-5xl">{lp.headline || ad.title}</h1>
		{#if lp.pitch}
			<p class="mx-auto max-w-2xl text-base opacity-95 md:text-xl">{lp.pitch}</p>
		{/if}
		{#if ad.mainImage}
			<img
				src={ad.mainImage}
				alt={ad.title}
				class="mx-auto mt-6 max-h-72 rounded-2xl object-cover shadow-2xl md:max-h-96"
			/>
		{/if}
	</header>

	<main class="mx-auto max-w-3xl space-y-8 px-4 py-8 md:py-12">
		{#if lp.advantages?.some((/** @type {string} */ a) => a?.trim())}
			<section>
				<ul class="mx-auto grid max-w-xl gap-3">
					{#each lp.advantages as a, i (i)}
						{#if a?.trim()}
							<li class="flex items-center gap-3 px-2 py-1">
								<span
									class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br {ad.gradient} font-black"
									>✓</span
								>
								<span class="text-base">{a}</span>
							</li>
						{/if}
					{/each}
				</ul>
			</section>
		{/if}

		{#if lp.extended}
			<section>
				<h2 class="mb-2 text-xl font-black">הסיפור שלנו</h2>
				<p class="whitespace-pre-line text-gray-200">{lp.extended}</p>
			</section>
		{/if}

		{#if lp.products?.length}
			<section>
				<h2 class="mb-3 text-xl font-black">מוצרים / שירותים</h2>
				<div class="grid gap-3 sm:grid-cols-2">
					{#each lp.products as p (p.id)}
						<article class="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
							{#if p.image}
								<img src={p.image} alt={p.name} class="h-20 w-20 rounded-lg object-cover" />
							{/if}
							<div class="min-w-0 flex-1">
								<h3 class="font-bold">{p.name}</h3>
								{#if p.price}<div class="font-black text-amber-300">{p.price} ₪</div>{/if}
								{#if p.description}<p class="mt-1 text-xs text-gray-300">{p.description}</p>{/if}
							</div>
						</article>
					{/each}
				</div>
			</section>
		{/if}

		{#if lp.uniqueness}
			<section>
				<h2 class="mb-2 text-xl font-black">מה מייחד אותנו</h2>
				<p class="whitespace-pre-line text-gray-200">{lp.uniqueness}</p>
			</section>
		{/if}

		<section class="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6">
			<h2 class="mb-3 text-xl font-black">פרטי קשר</h2>
			<div class="grid gap-2 text-sm sm:grid-cols-2">
				{#if lp.phone}<div>
						📞 <a href={`tel:${lp.phone}`} class="text-amber-300 hover:underline">{lp.phone}</a>
					</div>{/if}
				{#if lp.whatsapp}<div>
						💬 <a
							href={`https://wa.me/${lp.whatsapp.replace(/[^0-9]/g, '')}`}
							target="_blank"
							rel="noopener"
							class="text-emerald-300 hover:underline">{lp.whatsapp}</a
						>
					</div>{/if}
				{#if lp.email}<div>
						✉️ <a href={`mailto:${lp.email}`} class="text-amber-300 hover:underline">{lp.email}</a>
					</div>{/if}
				{#if lp.website}<div>
						🌐 <a
							href={lp.website}
							target="_blank"
							rel="noopener"
							class="text-amber-300 hover:underline">{lp.website}</a
						>
					</div>{/if}
				{#if lp.address}<div>📍 {lp.address}</div>{/if}
				{#if lp.hours}<div>🕒 {lp.hours}</div>{/if}
			</div>
		</section>

		<p class="text-center">
			<a href="/" class="text-sm text-gray-400 hover:text-blue-400">← חזרה למדריך</a>
		</p>
	</main>
</div>
