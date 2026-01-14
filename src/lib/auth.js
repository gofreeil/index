import { writable } from 'svelte/store';

// We'll use a writable store for the current user
export const authUser = writable(null);

// Initialize from localStorage if on browser
if (typeof window !== 'undefined') {
	const stored = localStorage.getItem('user');
	if (stored) {
		authUser.set(JSON.parse(stored));
	}
}

/**
 * @param {any} user
 */
export function setAuthUser(user) {
	if (user) {
		localStorage.setItem('user', JSON.stringify(user));
	} else {
		localStorage.removeItem('user');
	}
	authUser.set(user);
}

export function logout() {
	setAuthUser(null);
}
