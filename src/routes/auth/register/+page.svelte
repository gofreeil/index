<script>
	import { lang, translations } from '$lib/i18n';
	import { onMount } from 'svelte';
	import * as publicVars from '$env/static/public';
	const PUBLIC_GOOGLE_CLIENT_ID = publicVars['PUBLIC_GOOGLE_CLIENT_ID'] || '';

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let showPassword = $state(false);
	let showConfirm = $state(false);
	let loading = $state(false);
	let error = $state('');

	/**
	 * אחרי הרשמה מוצלחת = משתמש חדש → טעינה מלאה עם welcome=new כדי שה-WelcomeScreen
	 * שב-layout ייטען מחדש ויציג את מסך "ברוכים המצטרפים" עם רשת האתרים.
	 */
	function goWelcome() {
		window.location.href = '/?welcome=new';
	}

	/** @param {any} response */
	async function handleGoogleResponse(response) {
		loading = true;
		try {
			const res = await fetch('/api/auth/google', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ credential: response.credential })
			});
			const result = await res.json();
			if (result.success) {
				goWelcome();
			} else {
				error = result.error;
			}
		} catch (e) {
			error = t.googleSignInFailed;
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		const googleAuth = /** @type {any} */ (window).google;
		if (typeof window !== 'undefined' && googleAuth && PUBLIC_GOOGLE_CLIENT_ID) {
			googleAuth.accounts.id.initialize({
				client_id: PUBLIC_GOOGLE_CLIENT_ID,
				callback: handleGoogleResponse
			});
			googleAuth.accounts.id.renderButton(document.getElementById('google-button'), {
				theme: 'outline',
				size: 'large',
				width: '100%',
				text: 'signup_with',
				shape: 'pill'
			});
		}
	});

	// SSO "יוצאים לחירות": מפנים לקהילה, היא קובעת את העוגייה המשותפת gofreeil-auth
	// על .gofreeil.com ומחזירה ל-callback שמזהה את המשתמש דרך ה-Strapi המשותף.
	function loginWithCommunity() {
		const callback = `${window.location.origin}/auth/community-callback?returnTo=/`;
		window.location.href = `https://community.gofreeil.com/sso?callback=${encodeURIComponent(callback)}`;
	}

	async function handleRegister() {
		if (password !== confirmPassword) {
			error = t.passwordsDontMatch;
			return;
		}
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
				goWelcome();
			} else {
				error = result.error;
			}
		} catch (e) {
			error = t.registerFailed;
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>{t.registerTitle}</title>
</svelte:head>

<div class="flex min-h-[80vh] items-center justify-center px-4 py-12" dir={t.dir}>
	<div class="w-full max-w-md">
		<!-- כרטיס -->
		<div class="overflow-hidden rounded-3xl border border-white/10 bg-[#0f172a] shadow-2xl">
			<!-- פס עליון גרדיאנט -->
			<div class="h-1.5 bg-gradient-to-r from-green-500 via-blue-600 to-purple-600"></div>

			<div class="p-8 md:p-10">
				<!-- לוגו + כותרת -->
				<div class="mb-8 text-center">
					<div class="mb-4 flex justify-center">
						<div
							class="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-600 to-blue-700 shadow-xl"
						>
							<span class="text-3xl">🧰</span>
						</div>
					</div>
					<h1 class="mb-2 text-2xl font-black text-white">{t.joinCommunity}</h1>
					<p class="text-sm text-gray-400">{t.createAccount}</p>
				</div>

				<!-- הודעת שגיאה -->
				{#if error}
					<div
						role="alert"
						class="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center"
					>
						<p class="text-sm font-medium text-red-400">{error}</p>
					</div>
				{/if}

				<!-- טופס הרשמה -->
				<form
					onsubmit={(e) => {
						e.preventDefault();
						handleRegister();
					}}
				>
					<div class="mb-4">
						<label for="full-name" class="mb-2 block text-sm font-medium text-gray-400">
							{t.fullName}
						</label>
						<input
							id="full-name"
							type="text"
							required
							autocomplete="name"
							bind:value={name}
							placeholder={t.usernamePlaceholder}
							class="w-full rounded-xl border border-white/10 bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 transition-colors focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
						/>
					</div>

					<div class="mb-4">
						<label for="email-address" class="mb-2 block text-sm font-medium text-gray-400">
							{t.email}
						</label>
						<input
							id="email-address"
							type="email"
							required
							autocomplete="email"
							bind:value={email}
							placeholder="your@email.com"
							class="w-full rounded-xl border border-white/10 bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 transition-colors focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
						/>
					</div>

					<div class="mb-4">
						<label for="password" class="mb-2 block text-sm font-medium text-gray-400">
							{t.password}
						</label>
						<div class="relative">
							<input
								id="password"
								type={showPassword ? 'text' : 'password'}
								required
								minlength="6"
								autocomplete="new-password"
								bind:value={password}
								placeholder={t.passwordMin}
								class="w-full rounded-xl border border-white/10 bg-[#1e293b] px-4 py-3 pl-11 text-white placeholder-gray-500 transition-colors focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
							/>
							<button
								type="button"
								onclick={() => (showPassword = !showPassword)}
								class="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400 transition-colors hover:text-white"
								aria-label={showPassword ? t.hidePassword : t.showPassword}
							>
								{#if showPassword}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-5 w-5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										aria-hidden="true"
										focusable="false"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
										/>
									</svg>
								{:else}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-5 w-5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										aria-hidden="true"
										focusable="false"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
										/>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
										/>
									</svg>
								{/if}
							</button>
						</div>
					</div>

					<div class="mb-6">
						<label for="confirm-password" class="mb-2 block text-sm font-medium text-gray-400">
							{t.confirmPasswordLabel}
						</label>
						<div class="relative">
							<input
								id="confirm-password"
								type={showConfirm ? 'text' : 'password'}
								required
								minlength="6"
								autocomplete="new-password"
								bind:value={confirmPassword}
								placeholder={t.confirmPasswordPlaceholder}
								class="w-full rounded-xl border border-white/10 bg-[#1e293b] px-4 py-3 pl-11 text-white placeholder-gray-500 transition-colors focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
							/>
							<button
								type="button"
								onclick={() => (showConfirm = !showConfirm)}
								class="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400 transition-colors hover:text-white"
								aria-label={showConfirm ? t.hideConfirmPassword : t.showConfirmPassword}
							>
								{#if showConfirm}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-5 w-5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										aria-hidden="true"
										focusable="false"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
										/>
									</svg>
								{:else}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-5 w-5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										aria-hidden="true"
										focusable="false"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
										/>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
										/>
									</svg>
								{/if}
							</button>
						</div>
					</div>

					<button
						type="submit"
						disabled={loading}
						class="w-full cursor-pointer rounded-2xl bg-gradient-to-r from-green-600 to-blue-600 px-6 py-3.5 font-bold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:from-green-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{#if loading}
							<span class="inline-flex items-center gap-2">
								<span
									class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
								></span>
								{t.registering}
							</span>
						{:else}
							{t.registerBtn}
						{/if}
					</button>
				</form>

				<!-- מפריד "או" -->
				<div class="relative py-6">
					<div class="absolute inset-0 flex items-center">
						<div class="w-full border-t border-white/10"></div>
					</div>
					<div class="relative flex justify-center text-sm">
						<span class="bg-[#0f172a] px-3 text-gray-500">{t.or}</span>
					</div>
				</div>

				<!-- Google Identity Services -->
				<div id="google-button" class="flex justify-center"></div>

				<!-- SSO "יוצאים לחירות" -->
				<button
					type="button"
					onclick={loginWithCommunity}
					disabled={loading}
					class="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl login-grad px-4 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<span class="text-lg">🕊️</span>
					<span>{t.registerWithFreedom}</span>
				</button>
				<p class="mt-2 text-center text-xs leading-relaxed text-gray-500">
					{t.ssoRecognizeHint}
				</p>

				<!-- לינק ללוגין -->
				<p class="mt-6 text-center text-sm text-gray-500">
					{t.alreadyRegistered}
					<a
						href="/auth/login"
						class="font-medium text-purple-400 transition-colors hover:text-purple-300"
					>
						{t.loginHere}
					</a>
				</p>
			</div>
		</div>

		<!-- קישור חזרה -->
		<div class="mt-6 text-center">
			<a href="/" class="text-sm text-gray-500 transition-colors hover:text-gray-400">
				{t.backHomeArrow}
			</a>
		</div>
	</div>
</div>
