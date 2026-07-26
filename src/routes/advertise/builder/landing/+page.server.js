import { isPrivileged } from '$lib/server/strapi.js';

// כמו בבילדר הראשי — פתוח לכולם; isAdmin רק לתג האדמין.
/** @type {import('./$types').PageServerLoad} */
export function load({ locals }) {
	return {
		isAdmin: isPrivileged(locals.user),
		layoutUser: locals.user
			? { email: locals.user.email ?? null, name: locals.user.name ?? null }
			: null
	};
}
