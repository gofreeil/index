<script>
	import { lang, translations } from '$lib/i18n';
	import { setAuthUser } from '$lib/auth';
	import { goto } from '$app/navigation';

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');

	async function handleRegister() {
		loading = true;
		error = '';
		try {
			const response = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, email, password })
			});
			const result = await response.json();
			if (result.success) {
				setAuthUser(result.user);
				// Return to previous page or home
				const prev = document.referrer;
				if (prev && prev.includes(window.location.host)) {
					window.history.back();
				} else {
					goto('/');
				}
			} else {
				error = result.error;
			}
		} catch (e) {
			error = 'Registration failed. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex min-h-[80vh] items-center justify-center px-4 py-12">
	<div
		class="w-full max-w-md space-y-8 rounded-2xl border border-gray-100 bg-white p-8 shadow-xl dark:border-gray-700 dark:bg-gray-800"
	>
		<div>
			<h2 class="text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
				{t.register}
			</h2>
		</div>
		<form
			class="mt-8 space-y-6"
			onsubmit={(e) => {
				e.preventDefault();
				handleRegister();
			}}
		>
			<div class="space-y-4 rounded-md shadow-sm">
				<div>
					<label
						for="full-name"
						class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
						>{t.fullName}</label
					>
					<input
						id="full-name"
						type="text"
						required
						bind:value={name}
						class="relative block w-full appearance-none rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
					/>
				</div>
				<div>
					<label
						for="email-address"
						class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t.email}</label
					>
					<input
						id="email-address"
						type="email"
						autocomplete="email"
						required
						bind:value={email}
						class="relative block w-full appearance-none rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
					/>
				</div>
				<div>
					<label
						for="password"
						class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
						>{t.password}</label
					>
					<input
						id="password"
						type="password"
						autocomplete="new-password"
						required
						bind:value={password}
						class="relative block w-full appearance-none rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
					/>
				</div>
			</div>

			{#if error}
				<div class="text-center text-sm text-red-500">{error}</div>
			{/if}

			<div>
				<button
					type="submit"
					disabled={loading}
					class="group relative flex w-full justify-center rounded-full border border-transparent bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
				>
					{loading ? '...' : t.register}
				</button>
			</div>

			<div class="text-center">
				<a
					href="/auth/login"
					class="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
				>
					{t.alreadyHaveAccount}
				</a>
			</div>
		</form>
	</div>
</div>
