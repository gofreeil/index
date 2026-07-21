<script>
	import { onMount } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';

	let { data } = $props();

	let phase = $state('working');

	onMount(async () => {
		if (data.status === 'ok' && data.user) {
			// פעם ראשונה בדפדפן הזה → welcome=new מפעיל את מסך "ברוכים המצטרפים";
			// משתמש חוזר לא מקבל שום פרמטר ולא רואה מסך.
			let welcomed = true;
			try {
				welcomed = !!localStorage.getItem('gofreeil-welcomed');
			} catch {
				/* localStorage חסום — מתייחסים כאילו כבר בורך */
			}
			if (!welcomed) {
				// טעינה מלאה כדי שה-WelcomeScreen שב-layout ייטען מחדש ויקרא את הפרמטר
				const target = new URL(data.returnTo || '/', window.location.origin);
				target.searchParams.set('welcome', 'new');
				window.location.href = `${target.pathname}${target.search}${target.hash}`;
				return;
			}
			// ה-cookie המשותף (gofreeil-auth) כבר נקרא ב-hooks → locals.user; מרעננים
			// כדי שה-layout יאכלס את authUser, ואז חוזרים ליעד.
			await invalidateAll();
			await goto(data.returnTo || '/');
			return;
		}
		phase = 'not_registered';
	});
</script>

<svelte:head>
	<title>התחברות דרך יוצאים לחירות</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex min-h-[80vh] items-center justify-center px-4 py-12" dir="rtl">
	<div class="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-xl dark:border-gray-700 dark:bg-gray-800">
		{#if phase === 'working'}
			<div class="mb-4 text-5xl">🕊️</div>
			<h1 class="mb-2 text-2xl font-black text-gray-900 dark:text-white">מזהה אותך...</h1>
			<p class="text-sm text-gray-500 dark:text-gray-400">רק רגע, מתחברים דרך יוצאים לחירות</p>
		{:else}
			<div class="mb-4 text-5xl">🔒</div>
			<h1 class="mb-2 text-2xl font-black text-yellow-500">עדיין אינך ברשימה</h1>
			<p class="mb-6 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
				לא זיהינו אותך במערכת של יוצאים לחירות. אפשר להירשם כאן ישירות, או להצטרף דרך אתר הקהילה.
			</p>
			<div class="flex flex-col gap-2.5">
				<a href="/auth/register" class="w-full rounded-xl bg-blue-600 py-3 font-black text-white transition-opacity hover:opacity-90">
					✨ הרשמה לאתר
				</a>
				<a href="https://community.gofreeil.com/" class="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200">
					🕊️ הרשמה בקהילת יוצאים לחירות
				</a>
				<a href="/auth/login" class="mt-1 text-sm text-gray-400 underline hover:text-gray-600">חזרה להתחברות</a>
			</div>
		{/if}
	</div>
</div>
