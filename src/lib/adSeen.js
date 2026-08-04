// ============================================================
// adSeen.js — פעולת Svelte שסופרת חשיפה כשהמודעה באמת נראית על המסך.
//
// למה IntersectionObserver ולא onMount: סרגל הפרסומות מרונדר גם בנייד
// (hidden lg:block), ומודעה שאיש לא ראה אינה חשיפה. הספירה עצמה מנוהלת
// ב-$lib/adTrack.js — היא ממילא סופרת מודעה פעם אחת לכל ביקור.
//
// שימוש:  <a use:adSeen={ad.trackId}> … </a>
// id ריק/undefined (מודעות שותפים סטטיות) — לא נספר.
// ============================================================

import { markAdSeen } from './adTrack.js';

/**
 * @param {HTMLElement} node
 * @param {string|undefined|null} id
 */
export function adSeen(node, id) {
	let current = id;
	let visible = false;

	if (typeof IntersectionObserver === 'undefined') {
		return {
			update(/** @type {string|undefined|null} */ v) {
				current = v;
			}
		};
	}

	const obs = new IntersectionObserver(
		(entries) => {
			for (const e of entries) {
				visible = e.isIntersecting;
				if (visible) markAdSeen(current);
			}
		},
		// 40% מהמודעה בשדה הראייה — מספיק כדי שייחשב "נראה", ולא רק קצה
		{ threshold: 0.4 }
	);
	obs.observe(node);

	return {
		/** @param {string|undefined|null} v המודעה התחלפה במקום (סבב) — חשיפה חדשה */
		update(v) {
			current = v;
			if (visible) markAdSeen(current);
		},
		destroy() {
			obs.disconnect();
		}
	};
}
