<script>
	// דף הנחיתה של פרסומת — פורט מ-community/my_new_project/src/routes/ads/[id].
	// עיצוב מינימליסטי: הכותרת, משפט הפתיחה והיתרונות יושבים *ליד* התמונה
	// ולא מתחתיה — כדי לחסוך גלילה. הגולש רואה את כל העיקר במסך הראשון.
	import { onMount } from 'svelte';
	import { trackAdLanding, trackAdLead } from '$lib/adTrack.js';

	/** @type {{ data: any }} */
	let { data } = $props();

	const ad = $derived(data.ad);
	const lp = $derived(ad.landing ?? {});

	// מדידה: צפייה בדף הנחיתה, ולחיצה על אמצעי קשר = "פנייה". שני המדדים
	// מוצגים למפרסם באזור האישי (ראו $lib/adTrack.js).
	onMount(() => trackAdLanding(ad?.id));
	const lead = () => trackAdLead(ad?.id);

	const heroImage = $derived(lp.image || ad.mainImage || '');
	const advList = $derived((lp.advantages ?? []).filter((/** @type {string} */ a) => a?.trim()));

	// "אם נכנס בצורה סמטרית" — היתרונות נכנסים לטור שליד התמונה רק כשמשפט
	// הפתיחה קצר; אחרת הטור היה גבוה מהתמונה, ואז הם יורדים לשורה רחבה מתחת.
	// נמדד לפי האורך *המוצג* — כתובות ארוכות מתכווצות לגלולה עם שם האתר.
	const pitchLength = $derived(
		segments(lp.pitch).reduce((/** @type {number} */ n, s) => n + s.text.length, 0)
	);
	const advInHero = $derived(Boolean(heroImage) && advList.length > 0 && pitchLength <= 300);

	// כל דרך קשר מופיעה פעם אחת בלבד: ההדר מציג טלפון + וואטסאפ (או אתר
	// כשאין וואטסאפ), ולכן האתר נשאר לפרטי הקשר רק כשהוואטסאפ תפס את מקומו.
	const websiteInContact = $derived(Boolean(lp.website) && Boolean(lp.whatsapp));

	// כתובות שהמפרסם הדביק בתוך הטקסט הופכות לגלולת קישור קצרה (שם האתר)
	// במקום שורות ארוכות של URL שמנפחות את הדף.
	/** @param {string} raw */
	function segments(raw) {
		const text = String(raw ?? '');
		/** @type {Array<{ text: string, url: string }>} */
		const out = [];
		let last = 0;
		for (const m of text.matchAll(/https?:\/\/\S+/g)) {
			const start = m.index ?? 0;
			const url = m[0].replace(/[.,;:!?)\]]+$/, '');
			if (start > last) out.push({ text: text.slice(last, start), url: '' });
			out.push({ text: linkLabel(url), url });
			last = start + url.length;
		}
		if (last < text.length) out.push({ text: text.slice(last), url: '' });
		return out;
	}
	/** @param {string} url */
	function linkLabel(url) {
		try {
			return new URL(url).hostname.replace(/^www\./, '');
		} catch {
			return url;
		}
	}
</script>

<svelte:head>
	<title>{ad.title} — מדריך בעלי מקצוע</title>
	<meta name="description" content={ad.subtitle || ad.title} />
</svelte:head>

{#snippet rich(/** @type {string} */ raw)}{#each segments(raw) as s}{#if s.url}<a
				href={s.url}
				target="_blank"
				rel="noopener noreferrer"
				class="inline-block rounded-full bg-white/20 px-2 text-sm font-bold whitespace-nowrap hover:bg-white/30"
				>{s.text} ↗</a
			>{:else}{s.text}{/if}{/each}{/snippet}

<div class="min-h-screen text-white" dir="rtl">
	<!-- קומה 1+2+3 — הכל במסך הראשון, ליד התמונה -->
	<header class="bg-gradient-to-br {ad.gradient} px-4 py-8 md:py-12">
		<div
			class="mx-auto grid max-w-5xl items-center gap-6 text-center {heroImage
				? 'md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:text-right'
				: ''}"
		>
			<div class="min-w-0">
				{#if ad.logo}
					<img
						src={ad.logo}
						alt=""
						class="mb-3 h-[68px] w-[68px] rounded-2xl bg-white/10 object-contain p-2 md:h-[88px] md:w-[88px] {heroImage
							? 'mx-auto md:mx-0'
							: 'mx-auto'}"
					/>
				{/if}
				<h1 class="mb-2 text-2xl leading-tight font-black drop-shadow md:text-4xl">
					{lp.headline || ad.title}
				</h1>
				{#if lp.pitch}
					<p class="text-base [overflow-wrap:anywhere] whitespace-pre-line opacity-95">
						{@render rich(lp.pitch)}
					</p>
				{/if}

				{#if advInHero}
					<ul class="mt-4 grid gap-2 text-right">
						{#each advList as a, i (i)}
							<li class="flex items-center gap-2">
								<span
									class="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full bg-white/90 text-xs font-black text-gray-900"
									>✓</span
								>
								<span class="text-sm font-semibold">{a}</span>
							</li>
						{/each}
					</ul>
				{/if}

				{#if lp.phone || lp.whatsapp || lp.website}
					<div
						class="mt-4 flex flex-wrap justify-center gap-2 {heroImage ? 'md:justify-start' : ''}"
					>
						{#if lp.phone}
							<a
								href={`tel:${lp.phone}`}
								onclick={lead}
								class="inline-flex items-center rounded-full bg-white px-4 py-2 font-extrabold text-gray-900"
								>📞 {lp.phone}</a
							>
						{/if}
						{#if lp.whatsapp}
							<a
								href={`https://wa.me/${lp.whatsapp.replace(/[^0-9]/g, '')}`}
								onclick={lead}
								target="_blank"
								rel="noopener"
								class="inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 font-extrabold text-white"
								>וואטסאפ</a
							>
						{:else if lp.website}
							<a
								href={lp.website}
								onclick={lead}
								target="_blank"
								rel="noopener"
								class="inline-flex items-center rounded-full border border-white/35 bg-white/15 px-4 py-2 font-extrabold"
								>לאתר ←</a
							>
						{/if}
					</div>
				{/if}
			</div>

			{#if heroImage}
				<div class="min-w-0">
					<img
						src={heroImage}
						alt={ad.title}
						class="mx-auto block max-h-[17rem] w-auto max-w-full rounded-2xl shadow-2xl md:max-h-[27rem]"
					/>
				</div>
			{/if}
		</div>
	</header>

	<main class="mx-auto max-w-5xl space-y-6 px-4 py-6 md:py-8">
		<!-- יתרונות — רק אם לא נכנסו ליד התמונה; שורה רחבה, לא רשימה גבוהה -->
		{#if advList.length && !advInHero}
			<ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
				{#each advList as a, i (i)}
					<li class="flex items-center gap-2">
						<span
							class="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br {ad.gradient} text-xs font-black"
							>✓</span
						>
						<span class="text-sm font-semibold">{a}</span>
					</li>
				{/each}
			</ul>
		{/if}

		<!-- הסיפור + הייחוד זה לצד זה, במקום שתי קומות נפרדות -->
		{#if lp.extended || lp.uniqueness}
			<div class="grid gap-6 md:grid-cols-2">
				{#if lp.extended}
					<section>
						<h2 class="mb-2 text-lg font-black">הסיפור שלנו</h2>
						<p class="text-sm [overflow-wrap:anywhere] whitespace-pre-line text-gray-200">
							{@render rich(lp.extended)}
						</p>
					</section>
				{/if}
				{#if lp.uniqueness}
					<section>
						<h2 class="mb-2 text-lg font-black">מה מייחד אותנו</h2>
						<p class="text-sm [overflow-wrap:anywhere] whitespace-pre-line text-gray-200">
							{@render rich(lp.uniqueness)}
						</p>
					</section>
				{/if}
			</div>
		{/if}

		{#if lp.products?.length}
			<section>
				<h2 class="mb-3 text-lg font-black">מוצרים / שירותים</h2>
				<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

		<!-- פרטי קשר — רק מה שלא כבר מופיע ככפתור בהדר, כדי לא לחזור פעמיים.
		     הטלפון והוואטסאפ תמיד למעלה; האתר יורד לכאן רק כשהוואטסאפ תפס
		     את מקומו בהדר. -->
		{#if lp.email || websiteInContact || lp.address || lp.hours}
			<section class="text-center">
				{#if lp.email || websiteInContact}
					<div class="flex flex-wrap justify-center gap-2">
						{#if lp.email}
							<a
								href={`mailto:${lp.email}`}
								onclick={lead}
								class="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold hover:border-amber-300/45 hover:text-amber-200"
								>✉️ {lp.email}</a
							>
						{/if}
						{#if websiteInContact}
							<a
								href={lp.website}
								onclick={lead}
								target="_blank"
								rel="noopener"
								class="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold hover:border-amber-300/45 hover:text-amber-200"
								>🌐 {linkLabel(lp.website)}</a
							>
						{/if}
					</div>
				{/if}
				{#if lp.address || lp.hours}
					<p class="mt-3 text-xs text-gray-400">
						{#if lp.address}📍 {lp.address}{/if}{#if lp.address && lp.hours}
							·
						{/if}{#if lp.hours}🕒 {lp.hours}{/if}
					</p>
				{/if}
			</section>
		{/if}

		<p class="text-center">
			<a href="/" class="text-sm text-gray-400 hover:text-blue-400">← חזרה למדריך</a>
		</p>
	</main>
</div>
