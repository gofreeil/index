<script>
	import { lang, translations } from '$lib/i18n';
	import { OTHER_NETWORK_SITES } from '$lib/seo';

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	const year = new Date().getFullYear();
</script>

<footer class="mt-1 border-t border-white/10 bg-[#0d1117] py-0 md:mt-0 md:py-2">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<!-- רשת "יוצאים לחירות": קישורי טקסט אמיתיים לכל אתרי הרשת.
		     זה מה שמאפשר לגוגל ולמנועי ה-AI לזהות את כל האתרים כמותג אחד
		     ולחלק ביניהם את האמון (entity consolidation), ובמקביל שולח גם
		     מבקרים אנושיים בין האתרים. -->
		<nav aria-labelledby="network-links-title" class="border-b border-white/10 py-3">
			<h2
				id="network-links-title"
				class="mb-1.5 text-xs font-black tracking-wide text-yellow-400/90"
			>
				רשת יוצאים לחירות
			</h2>
			<ul
				class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-gray-400 md:text-xs"
			>
				{#each OTHER_NETWORK_SITES as site (site.url)}
					<li>
						<!-- לשונית חדשה, כמו כל קישור-חוץ באתר — הביקור כאן לא נקטע -->
						<a
							href={site.url}
							title={site.description}
							target="_blank"
							rel="noopener noreferrer"
							class="transition-colors hover:text-white"
						>
							{site.name}
						</a>
					</li>
				{/each}
			</ul>
		</nav>

		<div class="flex flex-col items-center justify-between gap-0 md:flex-row md:gap-6">
			<!-- ימין: תמונת המותג + טקסט -->
			<a
				href="https://gofreeil.com/"
				target="_blank"
				rel="noopener noreferrer"
				aria-label={t.freedomLinkAria}
				style="cursor: pointer;"
				class="flex items-center gap-3 transition-opacity hover:opacity-80"
			>
				<img
					src="/images/yotzim-lecherut.webp"
					alt={t.freedomMovement}
					class="h-28 w-28 flex-shrink-0 rounded-lg object-contain transition-transform hover:scale-105 md:h-32 md:w-32"
				/>

				<!-- מובייל: פריסה מקוצרת -->
				<div class="flex flex-col text-right text-sm leading-tight md:hidden">
					<p class="text-sm font-black text-yellow-400">
						{t.freedomMovement}
					</p>
					<p class="text-xs font-normal text-gray-300">
						{t.freedomTagline}
					</p>
				</div>

				<!-- דסקטופ -->
				<div class="hidden text-right leading-tight md:flex md:flex-col md:gap-1">
					<p class="text-base font-normal text-gray-300 md:text-lg">
						{t.freedomTagline}
					</p>
					<p
						class="flex items-center justify-end gap-2 text-lg font-black text-yellow-500 md:text-xl"
					>
						<span>👉</span>
						{t.freedomMovement}
					</p>
				</div>
			</a>

			<!-- מרכז: קישורים -->
			<!-- בנייד הקישורים ב-text-sm ובלי מפרידי | — בגודל דסקטופ הקישור
			     הארוך ("דווח על עסק...") גלש אל מחוץ למסך ונחתך ע"י
			     overflow-x: clip, ומפריד | נשאר יתום בסוף שורה. -->
			<nav
				aria-label={t.footerNavAria}
				class="flex max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-sm font-bold text-gray-300 md:text-lg"
			>
				<a href="/about/legal" class="text-center transition-colors hover:text-white">
					<span class="block md:hidden">{t.legalLinksL1} {t.legalLinksL2}</span>
					<span class="hidden whitespace-nowrap md:inline-block">{t.legalLinks}</span>
				</a>
				<span class="hidden font-black text-gray-600 md:inline" aria-hidden="true">|</span>
				<a href="/privacy" class="transition-colors hover:text-white">{t.privacy}</a>
				<span class="hidden font-black text-gray-600 md:inline" aria-hidden="true">|</span>
				<a
					href="mailto:support@melecshop.com"
					class="transition-colors hover:text-white"
					aria-label={t.contactEmailAria}>{t.contact}</a
				>
				<span class="hidden font-black text-gray-600 md:inline" aria-hidden="true">|</span>
				<a href="/about/advertise" class="transition-colors hover:text-white">{t.advertise}</a>
				<span class="hidden font-black text-gray-600 md:inline" aria-hidden="true">|</span>
				<a
					href="/report"
					class="max-w-full text-center text-red-500 transition-colors hover:text-red-300"
					>{t.reportViolation}</a
				>
			</nav>

			<!-- שמאל: זכויות יוצרים -->
			<p class="pb-4 text-center text-xs font-bold text-gray-400 md:pb-0 md:text-right md:text-lg">
				&copy; {year}
				{t.allRightsReserved}
			</p>
		</div>

		<!-- הקדשה (ייחודי ל-index) -->
		<div class="border-t border-white/5 py-2 text-center">
			<p class="text-xs text-gray-400">{t.dedication}</p>
		</div>
	</div>
</footer>
