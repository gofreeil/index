<script>
	import { onMount } from 'svelte';
	import * as publicVars from '$env/static/public';
	const PUBLIC_GOOGLE_CLIENT_ID = publicVars['PUBLIC_GOOGLE_CLIENT_ID'] || '';

	let { data } = $props();

	let phase = $state('working');
	let googleLoading = $state(false);
	let googleError = $state('');

	/** יעד החזרה עם welcome=<kind> - מפעיל את מסך הברכה שב-layout. @param {'new'|'back'} kind */
	function goWithWelcome(kind) {
		const target = new URL(data.returnTo || '/', window.location.origin);
		target.searchParams.set('welcome', kind);
		window.location.href = `${target.pathname}${target.search}${target.hash}`;
	}

	// הרשמה בלחיצה מתוך מסך "עדיין אין חשבון": Google יוצר חשבון (upsert ב-Strapi
	// המשותף) ומחזיר ליעד המקורי - בלי לשלוח את המשתמש לטופס.
	/** @param {any} response */
	async function handleGoogleResponse(response) {
		googleLoading = true;
		googleError = '';
		try {
			const res = await fetch('/api/auth/google', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ credential: response.credential })
			});
			const result = await res.json();
			if (result.success) {
				goWithWelcome('new');
				return;
			}
			googleError = result.error || 'ההתחברות עם Google נכשלה';
		} catch {
			googleError = 'ההתחברות עם Google נכשלה';
		} finally {
			googleLoading = false;
		}
	}

	// הסקריפט של Google (gsi/client) נטען async ב-app.html; הדף הזה נפתח בטעינה
	// מלאה מהפניה חיצונית, אז ייתכן שעוד לא הגיע - מנסים כמה פעמים.
	/** @param {number} attempt */
	function renderGoogleButton(attempt = 0) {
		if (!PUBLIC_GOOGLE_CLIENT_ID) return;
		const googleAuth = /** @type {any} */ (window).google;
		const el = document.getElementById('google-button');
		if (!el) return;
		if (!googleAuth?.accounts?.id) {
			if (attempt < 20) setTimeout(() => renderGoogleButton(attempt + 1), 250);
			return;
		}
		googleAuth.accounts.id.initialize({
			client_id: PUBLIC_GOOGLE_CLIENT_ID,
			callback: handleGoogleResponse
		});
		googleAuth.accounts.id.renderButton(el, {
			theme: 'outline',
			size: 'large',
			width: '100%',
			text: 'continue_with',
			shape: 'pill'
		});
	}

	onMount(() => {
		if (data.status === 'ok' && data.user) {
			// פעם ראשונה בדפדפן הזה → welcome=new ("ברוכים המצטרפים");
			// אחרת welcome=back ("ברוכים השבים") — כמו בכל אתרי הרשת.
			let kind = /** @type {'new'|'back'} */ ('back');
			try {
				if (!localStorage.getItem('gofreeil-welcomed')) kind = 'new';
			} catch {
				/* localStorage חסום — נשארים 'back' */
			}
			// טעינה מלאה כדי שה-WelcomeScreen שב-layout ייטען מחדש ויקרא את
			// הפרמטר; ה-cookie המשותף (gofreeil-auth) כבר נקרא ב-hooks → locals.user.
			goWithWelcome(kind);
			return;
		}
		phase = 'not_registered';
	});

	// כפתור Google נוצר רק אחרי שמסך "עדיין אין חשבון" מוצג (האלמנט קיים ב-DOM)
	$effect(() => {
		if (phase === 'not_registered') renderGoogleButton();
	});
</script>

<svelte:head>
	<title>התחברות דרך יוצאים לחירות</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex min-h-[80vh] items-center justify-center px-4 py-12" dir="rtl">
	<div
		class="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-xl dark:border-gray-700 dark:bg-gray-800"
	>
		{#if phase === 'working'}
			<div class="mb-4 text-5xl">🕊️</div>
			<h1 class="mb-2 text-2xl font-black text-gray-900 dark:text-white">מזהה אותך...</h1>
			<p class="text-sm text-gray-500 dark:text-gray-400">רק רגע, מתחברים דרך יוצאים לחירות</p>
		{:else}
			<div class="mb-4 text-5xl">🔒</div>
			<h1 class="mb-2 text-2xl font-black text-yellow-500">עוד רגע ואתם בפנים</h1>
			<p class="mb-1 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
				אתם בקבוצות הווצאפ של יוצאים לחירות, אבל עדיין אין לכם חשבון באתר. זה בסדר גמור, ככה זה
				לכולם בפעם הראשונה.
			</p>
			<p class="mb-6 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
				לחיצה אחת למטה יוצרת לכם חשבון, ומשם אתם מזוהים בכל אתרי יוצאים לחירות בלי להירשם שוב.
			</p>
			<div class="flex flex-col gap-2.5">
				{#if PUBLIC_GOOGLE_CLIENT_ID}
					<!-- Google Identity Services - כניסה בלחיצה שיוצרת חשבון -->
					<div id="google-button" class="flex justify-center"></div>
					{#if googleLoading}
						<p class="text-xs text-gray-400">מתחברים...</p>
					{/if}
					{#if googleError}
						<p class="text-sm text-red-500">{googleError}</p>
					{/if}
				{/if}
				<a
					href="/auth/register"
					class="mt-1 text-sm text-gray-400 underline hover:text-gray-600 dark:hover:text-gray-200"
				>
					מעדיפים אימייל וסיסמה? הרשמה ידנית
				</a>
				<a
					href="/auth/login"
					class="text-sm text-gray-400 underline hover:text-gray-600 dark:hover:text-gray-200"
					>חזרה להתחברות</a
				>
			</div>
		{/if}
	</div>
</div>
