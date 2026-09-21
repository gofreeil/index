<script>
	import { lang, translations } from '$lib/i18n';
	import { onMount } from 'svelte';
	import * as publicVars from '$env/static/public';
	const PUBLIC_GOOGLE_CLIENT_ID = publicVars['PUBLIC_GOOGLE_CLIENT_ID'] || '';

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	/** @type {{ data: { ssoName: string | null } }} */
	let { data } = $props();

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let ssoLoading = $state(false);
	let error = $state('');

	// ?returnTo=/נתיב — יעד מפורש אחרי ההתחברות (למשל דף עסק עם תיבת בקשת
	// הבעלות פתוחה, מתוך SMS שהאדמין שלח). רק נתיב יחסי באתר — לא כתובת
	// חיצונית, כדי שהקישור לא ישמש להפניה החוצה.
	function requestedReturnTo() {
		const raw = new URLSearchParams(window.location.search).get('returnTo') || '';
		return raw.startsWith('/') && !raw.startsWith('//') ? raw : '';
	}

	// מוסיף welcome=back ליעד — מפעיל את מסך "ברוכים השבים" אחרי ההתחברות.
	// טעינה מלאה (window.location) כדי שה-WelcomeScreen שב-layout ייטען מחדש
	// ויקרא את הפרמטר, וגם ירענן את מצב ההתחברות מהשרת.
	function backWithWelcome() {
		let dest = requestedReturnTo() || '/';
		const prev = document.referrer;
		if (dest === '/' && prev && prev.includes(window.location.host)) dest = prev;
		try {
			const u = new URL(dest, window.location.origin);
			u.searchParams.set('welcome', 'back');
			window.location.href = `${u.pathname}${u.search}${u.hash}`;
		} catch {
			window.location.href = '/?welcome=back';
		}
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
				backWithWelcome();
				return;
			} else {
				error = result.error;
			}
		} catch (e) {
			error = 'Google Sign-In failed';
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
				text: 'signin_with',
				shape: 'pill'
			});
		}
	});

	// SSO "יוצאים לחירות": מפנים לקהילה, היא קובעת את העוגייה המשותפת gofreeil-auth
	// על .gofreeil.com ומחזירה ל-callback שמזהה את המשתמש דרך ה-Strapi המשותף.
	// מי שאין לו חשבון בקהילה לא מוחזר לכאן עם שגיאה: אתר הקהילה מציע לו שם
	// כניסה בלחיצה (Google) ומחזיר אותו לכאן כבר מחובר.
	function loginWithCommunity() {
		loading = true;
		ssoLoading = true;
		const returnTo = encodeURIComponent(requestedReturnTo() || '/');
		const callback = `${window.location.origin}/auth/community-callback?returnTo=${returnTo}`;
		window.location.href = `https://community.gofreeil.com/sso?callback=${encodeURIComponent(callback)}`;
	}

	// זוהה מראש לפי העוגייה המשותפת: אין צורך לעבור דרך אתר הקהילה, ה-callback
	// המקומי מזהה את המשתמש ישירות מהעוגייה.
	function continueAsCommunityUser() {
		loading = true;
		ssoLoading = true;
		window.location.href = `/auth/community-callback?returnTo=${encodeURIComponent(requestedReturnTo() || '/')}`;
	}

	async function handleLogin() {
		loading = true;
		error = '';
		try {
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});
			const result = await response.json();
			if (result.success) {
				// חזרה לעמוד הקודם / הבית עם welcome=back ("ברוכים השבים")
				backWithWelcome();
				return;
			} else {
				error = result.error;
			}
		} catch (e) {
			error = 'Login failed. Please try again.';
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
				{t.login}
			</h2>
			<!-- הודעה למשתמש חדש: הכניסה עם Google היא גם ההרשמה -->
			{#if !data.ssoName}
				<p
					class="mt-3 text-center text-[13px] leading-relaxed font-bold text-amber-700 sm:text-sm dark:text-amber-300"
				>
					{t.firstTimeRegister}
				</p>
			{/if}
		</div>

		{#if data.ssoName}
			<!-- זוהה מראש דרך יוצאים לחירות (עוגייה משותפת חיה) -->
			<div class="mt-6">
				<button
					type="button"
					onclick={continueAsCommunityUser}
					disabled={loading}
					class="login-grad flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl px-6 py-3.5 font-bold text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{#if ssoLoading}
						<span
							class="h-5 w-5 flex-shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white"
						></span>
					{:else}
						<span class="flex-shrink-0 text-xl">🕊️</span>
					{/if}
					<span>המשך כ-{data.ssoName}</span>
				</button>
				<p class="mt-2 text-center text-xs leading-relaxed text-gray-500 dark:text-gray-400">
					זוהית דרך יוצאים לחירות. לא את/ה? אפשר להיכנס עם חשבון אחר למטה.
				</p>

				<!-- מפריד -->
				<div class="relative py-4">
					<div class="absolute inset-0 flex items-center">
						<div class="w-full border-t border-gray-200 dark:border-gray-700"></div>
					</div>
					<div class="relative flex justify-center text-sm">
						<span class="bg-white px-2 text-gray-500 dark:bg-gray-800">{t.or}</span>
					</div>
				</div>
			</div>
		{/if}
		<form
			class="mt-8 space-y-6"
			onsubmit={(e) => {
				e.preventDefault();
				handleLogin();
			}}
		>
			<div class="space-y-4 rounded-md shadow-sm">
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
						autocomplete="current-password"
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
					{loading ? '...' : t.login}
				</button>
			</div>

			<div class="relative py-4">
				<div class="absolute inset-0 flex items-center">
					<div class="w-full border-t border-gray-200 dark:border-gray-700"></div>
				</div>
				<div class="relative flex justify-center text-sm">
					<span class="bg-white px-2 text-gray-500 dark:bg-gray-800">או</span>
				</div>
			</div>

			<div id="google-button" class="flex justify-center"></div>

			{#if !data.ssoName}
				<!-- יוצאים לחירות (SSO) - אפשרות משנית למי שכבר יש לו חשבון באתר הקהילה.
				     חברי קבוצות הווצאפ בלי חשבון: הכפתור לא נכשל, אתר הקהילה מציע להם
				     כניסה בלחיצה ומחזיר אותם לכאן מחוברים. -->
				<button
					type="button"
					onclick={loginWithCommunity}
					disabled={loading}
					class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-purple-400/50 bg-purple-500/10 px-4 py-2.5 text-sm font-bold text-purple-800 transition hover:border-purple-400/80 hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-purple-100"
				>
					{#if ssoLoading}
						<span
							class="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-purple-400/40 border-t-purple-600 dark:border-t-white"
						></span>
					{:else}
						<span class="flex-shrink-0 text-lg">🕊️</span>
					{/if}
					<span>כניסה דרך קהילת יוצאים לחירות (חשבון קיים או קוד ב-SMS)</span>
				</button>
				<p class="text-center text-xs leading-relaxed text-gray-400">
					חברות בקבוצות הווצאפ אינה חשבון באתר. אם עדיין אין לך חשבון, הכניסה עם Google למעלה יוצרת
					אחד בלחיצה.
				</p>
			{/if}

			<div class="text-center">
				<a
					href="/auth/register"
					class="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
				>
					{t.dontHaveAccount}
				</a>
			</div>
		</form>
	</div>
</div>
