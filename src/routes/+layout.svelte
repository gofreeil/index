<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>מדריך העסקים - יוצאים לחירות</title>

	<!-- Meta Tags for Social Media (Open Graph) -->
	<meta property="og:title" content="מדריך העסקים - יוצאים לחירות" />
	<meta property="og:description" content="גלו עסקים מקומיים והטבות בלעדיות לחברי יוצאים לחירות" />
	<meta property="og:image" content="/og-image.png" />
	<meta property="og:type" content="website" />

	<!-- Twitter Meta Tags -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="מדריך העסקים - יוצאים לחירות" />
	<meta name="twitter:description" content="גלו עסקים מקומיים והטבות בלעדיות לחברי יוצאים לחירות" />
	<meta name="twitter:image" content="/og-image.png" />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
	<!-- Header -->
	<header class="sticky top-0 z-50 bg-white/80 shadow-sm backdrop-blur-md">
		<div class="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
			<div class="flex items-center justify-between">
				<!-- Title & Logo Section -->
				<a href="/" class="flex items-center gap-3 transition-opacity hover:opacity-80">
					<img
						src="/logo.png"
						alt="לוגו"
						class="h-10 w-10 rounded-full object-cover shadow-sm sm:h-14 sm:w-14"
					/>
					<div class="flex flex-col text-right">
						<h1
							class="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-right text-2xl font-bold text-transparent sm:text-4xl"
						>
							מדריך העסקים שלנו
						</h1>
						<p class="hidden text-right text-sm text-gray-600 sm:block">
							גלו עסקים מקומיים והטבות בלעדיות לחברי יוצאים לחירות
						</p>
					</div>
				</a>

				<!-- Action Buttons -->
				<div class="flex items-center gap-2">
					<!-- Community Policy Button -->
					<a
						href="/policy"
						class="flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-200 to-yellow-400 px-4 py-2.5 text-sm font-bold text-yellow-900 shadow-sm transition-all hover:scale-105 hover:shadow-md active:scale-95"
					>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
						<span>מדיניות הקהילה</span>
					</a>

					<!-- Add Store Button -->
					<a
						href="https://docs.google.com/forms/d/e/1FAIpQLSe2wvCp484_PyoJyDZ_n8GupIQVy00ozt5rxOhsWklr7UPkXQ/viewform?usp=header"
						target="_blank"
						class="group flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg active:scale-95"
					>
						<svg
							class="h-5 w-5 transition-transform group-hover:rotate-90"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2.5"
								d="M12 4v16m8-8H4"
							/>
						</svg>
						<span>הוסף חנות</span>
					</a>
				</div>
			</div>
			<p class="mt-2 text-right text-xs text-gray-600 sm:hidden">
				גלו עסקים מקומיים והטבות בלעדיות לחברי יוצאים לחירות
			</p>
		</div>
	</header>

	{@render children()}

	<footer class="mt-16 border-t bg-gray-50 py-8">
		<div class="mx-auto max-w-7xl px-4 text-right text-gray-600">
			<div class="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-12">
				<!-- Button on the right (first in RTL) -->
				<a
					href="https://www.melecshop.com/"
					target="_blank"
					class="flex shrink-0 flex-col items-center rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-1 text-white shadow-xl transition-all hover:scale-105 hover:shadow-2xl active:scale-95"
				>
					<span class="text-xl font-black tracking-wider">יוצאים לחירות</span>
					<span class="text-sm font-medium opacity-90">בונים עולם חדש!</span>
				</a>

				<!-- Words on the left -->
				<div class="flex flex-col gap-2">
					<p class="text-lg font-medium">
						רוצים להוסיף את העסק שלכם? <a
							href="https://docs.google.com/forms/d/e/1FAIpQLSe2wvCp484_PyoJyDZ_n8GupIQVy00ozt5rxOhsWklr7UPkXQ/viewform?usp=header"
							target="_blank"
							class="text-blue-600 hover:underline">מלאו את הטופס</a
						>
					</p>
					<p>
						<a
							href="https://docs.google.com/forms/d/e/1FAIpQLScwLo3V6wBwv-PcZYNGx9TDsVAQUvsRuQw5wUeuO_h_90C1tQ/viewform?usp=header"
							target="_blank"
							class="text-lg font-medium text-red-500 hover:underline"
						>
							הזמן בעל עסק לבית הדין/ פיוס של יוצאים לחירות
						</a>
					</p>
				</div>
			</div>

			<div class="mt-8 border-t border-gray-200 pt-8 text-center">
				<p class="text-xs text-gray-500">
					רשימת בעלי העסקים תחת 7 מצוות בני נח לעילוי נשמת קלמן אליעזר בן יוסף צדוק
				</p>
			</div>
		</div>
	</footer>
</div>

<style>
	:global(body) {
		direction: rtl;
		font-family:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
	}
</style>
