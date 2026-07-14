// מוחק את כל רשומות idx-business ב-Strapi (ניקוי לפני ייבוא מחדש נקי).
// דורש STRAPI_TOKEN מהימן (trusted) — הרצה: node --env-file=.env scripts/wipe-idx-businesses.mjs
const STRAPI = (process.env.STRAPI_URL || 'https://api.gofreeil.com').replace(/\/$/, '');
const TOKEN = process.env.STRAPI_TOKEN;
if (!TOKEN) throw new Error('חסר STRAPI_TOKEN');

const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

async function main() {
	let deleted = 0;
	for (let guard = 0; guard < 100; guard++) {
		const res = await fetch(
			`${STRAPI}/api/idx-businesses?fields[0]=name&pagination[pageSize]=100`,
			{ headers: H }
		);
		const j = await res.json();
		const rows = j?.data ?? [];
		if (rows.length === 0) break;
		for (const r of rows) {
			const d = await fetch(`${STRAPI}/api/idx-businesses/${r.documentId}`, {
				method: 'DELETE',
				headers: H
			});
			if (d.ok) deleted++;
			else console.log(`✗ מחיקה נכשלה ${r.documentId}: ${d.status}`);
		}
		console.log(`נמחקו עד כה: ${deleted}`);
	}
	console.log(`\nסה"כ נמחקו: ${deleted}`);
}
main().catch((e) => {
	console.error(e);
	process.exit(1);
});
