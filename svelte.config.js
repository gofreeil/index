import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { MEDIA_HOST, IMG_WIDTHS } from './src/lib/mediaConfig.js';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter({
			// ממטב התמונות של Vercel — בלי ההצהרה הזו הנתיב ‎/_vercel/image‎ לא
			// קיים בפריסה בכלל. מי שמשתמש בו: $lib/img.js.
			images: {
				sizes: IMG_WIDTHS, // רק רוחבים שברשימה; כל השאר → 400
				domains: [MEDIA_HOST],
				remotePatterns: [{ protocol: 'https', hostname: MEDIA_HOST }],
				formats: ['image/avif', 'image/webp'],
				// שם הקובץ ב-Strapi כולל חתימה ומשתנה בכל העלאה, ולכן מטמון ארוך
				// אינו יכול להגיש תמונה ישנה
				minimumCacheTTL: 2592000 // 30 יום
			}
		})
	}
};

export default config;
