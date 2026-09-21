<script>
	import { enhance } from '$app/forms';

	/** @type {{ data: { valid: boolean, bizName: string }, form: any }} */
	let { data, form } = $props();
	let sending = $state(false);
</script>

<svelte:head>
	<title>הכרטיסייה לא שלי — בעלי מקצוע כשירים</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="mx-auto max-w-lg px-4 py-10" dir="rtl">
	<div class="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
		{#if form?.done}
			<p class="text-2xl">🙏</p>
			<h1 class="mt-2 text-xl font-bold text-gray-100">תודה, סימנו שהכרטיסייה לא שלך</h1>
			<p class="mt-2 text-base leading-7 text-gray-400">
				לא נפנה אליך שוב בעניין הזה. אם בכל זאת יש לך עסק שמגיע לו מקום במדריך, אפשר להוסיף
				אותו בעצמך.
			</p>
			<a
				href="/"
				class="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-2 text-base font-semibold text-white transition hover:bg-blue-500"
			>
				למדריך
			</a>
		{:else if !data.valid}
			<h1 class="text-xl font-bold text-gray-100">הקישור אינו תקין</h1>
			<p class="mt-2 text-base leading-7 text-gray-400">
				ייתכן שהוא הועתק חלקית מההודעה. אפשר פשוט להתעלם מה-SMS.
			</p>
		{:else}
			<h1 class="text-xl font-bold text-gray-100">
				הכרטיסייה {data.bizName ? `"${data.bizName}"` : 'הזו'} אינה שלך?
			</h1>
			<p class="mt-2 text-base leading-7 text-gray-400">
				קיבלת הודעה כי הטלפון או האימייל שלך תואמים לכרטיסייה במדריך. אם זו טעות, לחיצה כאן
				סוגרת את העניין ולא נפנה אליך שוב.
			</p>
			{#if form?.error}
				<p class="mt-3 text-sm text-red-400">{form.error}</p>
			{/if}
			<form
				method="POST"
				use:enhance={() => {
					sending = true;
					return async ({ update }) => {
						await update({ reset: false });
						sending = false;
					};
				}}
				class="mt-4 flex flex-wrap justify-center gap-2"
			>
				<button
					disabled={sending}
					class="rounded-lg bg-gray-700 px-5 py-2 text-base font-semibold text-white transition hover:bg-gray-600 disabled:opacity-40"
				>
					{sending ? '…' : 'כן, הכרטיסייה לא שלי'}
				</button>
				<a
					href="/"
					class="rounded-lg border border-white/15 px-5 py-2 text-base font-semibold text-gray-200 transition hover:bg-white/5"
				>
					ביטול
				</a>
			</form>
		{/if}
	</div>
</main>
