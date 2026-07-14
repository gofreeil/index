import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// מועדפים — Svelte store שנשמר ל-localStorage. מחליף את ה-monkey-patch של
// localStorage.setItem שהיה בעמוד הבית (דליפת גלובל + לא-reactive).
const KEY = 'favorites';

function load() {
	if (!browser) return [];
	try {
		const v = JSON.parse(localStorage.getItem(KEY) || '[]');
		return Array.isArray(v) ? v : [];
	} catch {
		return [];
	}
}

export const favorites = writable(/** @type {string[]} */ (load()));

if (browser) {
	favorites.subscribe((v) => {
		try {
			localStorage.setItem(KEY, JSON.stringify(v));
		} catch {
			/* מצב פרטי / חסום — מתעלמים */
		}
	});
}

/** @param {string} id */
export function toggleFavorite(id) {
	favorites.update((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
}
