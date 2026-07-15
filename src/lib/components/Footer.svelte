<script>
	import { lang, translations } from '$lib/i18n';

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	const year = new Date().getFullYear();
</script>

<footer class="mt-1 border-t border-white/10 bg-[#0d1117] py-0 md:mt-0 md:py-2">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
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
			<nav
				aria-label={t.footerNavAria}
				class="flex flex-wrap items-center justify-center gap-4 text-base font-bold text-gray-300 md:text-lg"
			>
				<a href="/about/legal" class="transition-colors hover:text-white">
					<span class="block md:hidden">{t.legalLinksL1}<br />{t.legalLinksL2}</span>
					<span class="hidden whitespace-nowrap md:inline-block">{t.legalLinks}</span>
				</a>
				<span class="font-black text-gray-600" aria-hidden="true">|</span>
				<a href="/privacy" class="transition-colors hover:text-white">{t.privacy}</a>
				<span class="font-black text-gray-600" aria-hidden="true">|</span>
				<a
					href="mailto:support@melecshop.com"
					class="transition-colors hover:text-white"
					aria-label={t.contactEmailAria}>{t.contact}</a
				>
				<span class="font-black text-gray-600" aria-hidden="true">|</span>
				<a href="/about/advertise" class="transition-colors hover:text-white">{t.advertise}</a>
				<span class="font-black text-gray-600" aria-hidden="true">|</span>
				<a href="/report" class="text-red-500 transition-colors hover:text-red-300"
					>{t.reportViolation}</a
				>
			</nav>

			<!-- שמאל: זכויות יוצרים -->
			<p
				class="pb-4 text-center text-[10px] font-bold text-gray-400 md:pb-0 md:text-right md:text-lg"
			>
				&copy; {year}
				{t.allRightsReserved}
			</p>
		</div>

		<!-- הקדשה (ייחודי ל-index) -->
		<div class="border-t border-white/5 py-2 text-center">
			<p class="text-[11px] text-gray-500">{t.dedication}</p>
		</div>
	</div>
</footer>
