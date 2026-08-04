<script>
	import { enhance } from '$app/forms';

	/** @type {{ data: any, form: any }} */
	let { data, form } = $props();

	// שדה החיפוש נזרע מ-q שב-URL בטעינה בלבד — עריכה חיה עד שליחת הטופס (GET)
	// svelte-ignore state_referenced_locally
	let q = $state(data.q ?? '');
	let busy = $state('');

	/** @type {Record<string, [string, string]>} */
	const ROLE_HE = {
		super_admin: ['👑 סופר-אדמין', 'bg-amber-900/40 text-amber-300 border-amber-500/40'],
		idx_admin: ['🛡️ אדמין האינדקס', 'bg-blue-900/40 text-blue-300 border-blue-500/40'],
		user: ['משתמש רגיל', 'bg-gray-800 text-gray-300 border-gray-600/40']
	};
	// תפקיד של אתר אחר (ch_admin וכד') — לא מנוהל מכאן
	/** @param {any} u */
	const foreignRole = (u) => u.app_role && !(u.app_role in ROLE_HE);
	/** @param {string} r */
	const roleHe = (r) => ROLE_HE[r] ?? [r, 'bg-gray-800 text-gray-300 border-gray-600/40'];

	/** @param {string} iso */
	const fmtDate = (iso) => {
		if (!iso) return '';
		try {
			return new Date(iso).toLocaleDateString('he-IL', {
				day: '2-digit',
				month: '2-digit',
				year: '2-digit'
			});
		} catch {
			return '';
		}
	};

	const OWNER = 'yahavanter@gmail.com';
	/** @param {any} u המשתמש מוגן משינוי (בעל האתר / אתה עצמך) */
	const isProtected = (u) =>
		u.email?.toLowerCase() === OWNER || String(u.id) === String(data.user?.id);

	// תוצאות החיפוש בלי מי שכבר אדמין (מופיע ברשימה למעלה)
	const adminIds = $derived(new Set(data.admins.map((/** @type {any} */ a) => a.id)));
	const searchResults = $derived(
		(data.results ?? []).filter((/** @type {any} */ u) => !adminIds.has(u.id))
	);

	/** @param {string} id */
	const submitFn = (id) => () => {
		busy = id;
		return async (/** @type {any} */ { update }) => {
			await update({ reset: false });
			busy = '';
		};
	};
</script>

<svelte:head>
	<title>ניהול אדמינים — פאנל ניהול</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="mx-auto max-w-4xl pb-10" dir="rtl">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-extrabold text-gray-100">👥 ניהול אדמינים</h1>
			<p class="mt-1 text-sm text-gray-500">
				מינוי והסרה של אדמינים לאתר הזה — לסופר-אדמין בלבד. לכל אתר אדמינים משלו; תפקידים של אתרים
				אחרים לא מוצגים ולא ניתנים לשינוי מכאן.
			</p>
		</div>
		<a href="/admin" class="text-sm text-gray-400 hover:text-blue-400">← לפאנל</a>
	</div>

	{#if form?.success}
		<div
			class="mb-4 rounded-xl border border-green-500/30 bg-green-900/20 p-3 text-center text-green-300"
		>
			✓ {form.message}
		</div>
	{/if}
	{#if form?.error}
		<div
			class="mb-4 rounded-xl border border-red-500/30 bg-red-900/20 p-3 text-center text-red-300"
		>
			{form.error}
		</div>
	{/if}

	<!-- הצוות הנוכחי -->
	<section class="mb-8">
		<h2 class="mb-3 font-bold text-gray-200">
			הצוות הנוכחי
			<span class="mr-1 rounded-full bg-gray-700 px-2 py-0.5 text-xs text-white"
				>{data.admins.length}</span
			>
		</h2>
		{#if data.admins.length === 0}
			<p class="rounded-2xl border border-dashed border-gray-800 py-10 text-center text-gray-500">
				אין עדיין אדמינים ממונים
			</p>
		{:else}
			<div class="space-y-2">
				{#each data.admins as u (u.id)}
					{@const [lbl, cls] = roleHe(u.app_role)}
					<div class="rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
						<div class="flex flex-wrap items-center gap-3">
							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center gap-2">
									<span class="font-bold text-gray-100">{u.name || u.email}</span>
									<span class="rounded-full border px-2 py-0.5 text-[11px] font-bold {cls}"
										>{lbl}</span
									>
									{#if u.email?.toLowerCase() === OWNER}
										<span class="text-[11px] text-gray-500">(בעל האתר)</span>
									{/if}
								</div>
								<p class="mt-0.5 truncate text-xs text-gray-500" dir="ltr">
									{u.email} · #{u.id}{u.created_at ? ' · ' + fmtDate(u.created_at) : ''}
								</p>
							</div>
							{#if !isProtected(u)}
								<div class="flex flex-shrink-0 flex-wrap items-center gap-2">
									<!-- שינוי תפקיד -->
									<form
										method="POST"
										action="?/setRole"
										use:enhance={submitFn(u.id + 'role')}
										class="flex items-center gap-2"
									>
										<input type="hidden" name="userId" value={u.id} />
										<select
											name="role"
											value={u.app_role}
											class="rounded-lg border border-gray-700 bg-gray-900/60 px-2 py-1.5 text-xs text-gray-100 focus:outline-none"
										>
											<option value="super_admin">סופר-אדמין</option>
											<option value="idx_admin">אדמין האינדקס</option>
										</select>
										<button
											disabled={busy === u.id + 'role'}
											class="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-40"
										>
											{busy === u.id + 'role' ? '…' : 'עדכן תפקיד'}
										</button>
									</form>
									<!-- הסרה -->
									<form
										method="POST"
										action="?/setRole"
										use:enhance={(/** @type {any} */ { cancel }) => {
											if (!confirm(`להסיר את ${u.name || u.email} מתפקיד ניהולי?`)) {
												cancel();
												return;
											}
											busy = u.id + 'rm';
											return async (/** @type {any} */ { update }) => {
												await update({ reset: false });
												busy = '';
											};
										}}
									>
										<input type="hidden" name="userId" value={u.id} />
										<input type="hidden" name="role" value="user" />
										<button
											disabled={busy === u.id + 'rm'}
											class="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-1.5 text-xs font-bold text-red-300 transition hover:bg-red-900/50 disabled:opacity-40"
										>
											{busy === u.id + 'rm' ? '…' : 'הסר'}
										</button>
									</form>
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<!-- מינוי אדמין חדש -->
	<section>
		<h2 class="mb-3 font-bold text-gray-200">מינוי אדמין חדש</h2>
		<form method="GET" class="mb-4 flex gap-2">
			<input
				type="search"
				name="q"
				bind:value={q}
				placeholder="חיפוש משתמש לפי אימייל או שם (לפחות 2 תווים)…"
				class="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900/60 px-4 py-2.5 text-sm text-gray-100 placeholder:text-gray-600 focus:border-blue-500/60 focus:outline-none"
			/>
			<button
				class="rounded-xl bg-gray-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-gray-600"
			>
				🔎 חפש
			</button>
		</form>

		{#if data.q && data.q.length >= 2}
			{#if searchResults.length === 0}
				<p class="rounded-2xl border border-dashed border-gray-800 py-10 text-center text-gray-500">
					לא נמצאו משתמשים מתאימים ל"{data.q}"
				</p>
			{:else}
				<div class="space-y-2">
					{#each searchResults as u (u.id)}
						<div class="rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
							<div class="flex flex-wrap items-center gap-3">
								<div class="min-w-0 flex-1">
									<span class="font-bold text-gray-100">{u.name || u.email}</span>
									<p class="mt-0.5 truncate text-xs text-gray-500" dir="ltr">
										{u.email} · #{u.id}{u.registered_site ? ' · ' + u.registered_site : ''}
									</p>
								</div>
								{#if foreignRole(u)}
									<span
										class="rounded-full border border-gray-600/40 bg-gray-800 px-3 py-1 text-[11px] font-bold text-gray-400"
										title="app_role: {u.app_role}"
									>
										תפקיד באתר אחר — מנוהל משם
									</span>
								{:else}
									<form
										method="POST"
										action="?/setRole"
										use:enhance={submitFn(u.id + 'appoint')}
										class="flex flex-shrink-0 items-center gap-2"
									>
										<input type="hidden" name="userId" value={u.id} />
										<select
											name="role"
											class="rounded-lg border border-gray-700 bg-gray-900/60 px-2 py-1.5 text-xs text-gray-100 focus:outline-none"
										>
											<option value="idx_admin">אדמין האינדקס</option>
											<option value="super_admin">סופר-אדמין</option>
										</select>
										<button
											disabled={busy === u.id + 'appoint'}
											class="rounded-lg bg-green-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-green-700 disabled:opacity-40"
										>
											{busy === u.id + 'appoint' ? '…' : '✚ מנה'}
										</button>
									</form>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{:else}
			<p class="text-sm text-gray-600">
				חפשו משתמש קיים כדי למנות אותו. משתמש חייב להירשם לאתר פעם אחת לפני שאפשר למנות אותו.
			</p>
		{/if}
	</section>
</main>
