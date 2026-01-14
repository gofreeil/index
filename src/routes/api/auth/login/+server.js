import { json } from '@sveltejs/kit';
import { google } from 'googleapis';
import { GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, SPREADSHEET_ID } from '$env/static/private';

/** @param {string} str */
const clean = (str) => {
	if (!str) return '';
	let cleaned = str
		.replace(/\\r\\n/g, '\n')
		.replace(/\\n/g, '\n')
		.replace(/\r\n/g, '\n');
	cleaned = cleaned.replace(/\\\n/g, '\n');
	cleaned = cleaned.trim();
	if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
		cleaned = cleaned.substring(1, cleaned.length - 1);
	}
	if (cleaned.includes('BEGIN')) {
		const header = '-----BEGIN PRIVATE KEY-----';
		const footer = '-----END PRIVATE KEY-----';
		let body = cleaned
			.replace(/-----BEGIN[\s\S]*?KEY-----/g, '')
			.replace(/-----END[\s\S]*?KEY-----/g, '')
			.replace(/\\/g, '')
			.replace(/\s+/g, '');
		let formattedBody = '';
		for (let i = 0; i < body.length; i += 64) {
			formattedBody += body.substring(i, i + 64) + '\n';
		}
		cleaned = `${header}\n${formattedBody}${footer}`;
	}
	return cleaned;
};

const auth = new google.auth.GoogleAuth({
	credentials: {
		client_email: clean(GOOGLE_CLIENT_EMAIL),
		private_key: clean(GOOGLE_PRIVATE_KEY)
	},
	scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });
const USERS_SHEET_NAME = 'Users';

export async function POST({ request }) {
	try {
		const { email, password } = await request.json();
		const spreadsheetId = clean(SPREADSHEET_ID);

		// Fetch all users
		const response = await sheets.spreadsheets.values.get({
			spreadsheetId,
			range: `${USERS_SHEET_NAME}!A:E`
		});

		const rows = response.data.values || [];
		const headers = rows[0];
		const users = rows.slice(1).map((row) => {
			/** @type {any} */
			const user = {};
			headers.forEach((header, i) => {
				user[header.toLowerCase()] = row[i];
			});
			return user;
		});

		/** @type {any} */
		const user = users.find((u) => u.email === email && u.password === password);

		if (!user) {
			return json({ success: false, error: 'Invalid email or password' }, { status: 401 });
		}

		return json({
			success: true,
			user: { id: user.id, name: user.name, email: user.email }
		});
	} catch (error) {
		console.error('Login API Error:', error);
		return json({ success: false, error: 'Login failed' }, { status: 500 });
	}
}
