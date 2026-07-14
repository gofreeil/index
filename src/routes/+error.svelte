<script>
	import { page } from '$app/stores';
</script>

<main class="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center" dir="rtl">
	<div class="text-7xl font-black text-blue-500">{$page.status}</div>
	<h1 class="mt-4 text-2xl font-bold text-gray-100">
		{$page.error?.message || 'משהו השתבש'}
	</h1>
	<a
		href="/"
		class="mt-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-3 font-bold text-white transition hover:scale-105"
	>
		חזרה למדריך העסקים
	</a>
</main>
