// חושף את המשתמש המחובר (מ-hooks) לכל הדפים; הלקוח מאכלס ממנו את authUser.
export function load({ locals }) {
	return { user: locals.user };
}
