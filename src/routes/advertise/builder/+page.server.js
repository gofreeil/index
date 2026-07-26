import { isPrivileged } from '$lib/server/strapi.js';

// הבילדר פתוח לכולם — קודם מעצבים, ועניין התשלום מגיע רק בשלב השליחה
// (בעורך דף הנחיתה). isAdmin משמש רק לתג "מצב אדמין" בתחתית הבילדר.
/** @type {import('./$types').PageServerLoad} */
export function load({ locals }) {
	return {
		isAdmin: isPrivileged(locals.user),
		layoutUser: locals.user
			? { email: locals.user.email ?? null, name: locals.user.name ?? null }
			: null
	};
}
