import { json } from '@sveltejs/kit';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as privateVars from '$env/static/private';
import * as publicVars from '$env/static/public';

const GOOGLE_CLIENT_EMAIL = privateVars['GOOGLE_CLIENT_EMAIL'] || '';
const GOOGLE_PRIVATE_KEY = privateVars['GOOGLE_PRIVATE_KEY'] || '';
const SPREADSHEET_ID = privateVars['SPREADSHEET_ID'] || '';
const PUBLIC_GOOGLE_CLIENT_ID = publicVars['PUBLIC_GOOGLE_CLIENT_ID'] || '';


/** @param {string} str */
const clean = (str) => {
    if (!str) return '';
    let cleaned = str.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
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

const gAuth = new google.auth.GoogleAuth({
    credentials: {
        client_email: clean(GOOGLE_CLIENT_EMAIL),
        private_key: clean(GOOGLE_PRIVATE_KEY),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth: gAuth });
const USERS_SHEET_NAME = 'Users';
const client = new OAuth2Client(PUBLIC_GOOGLE_CLIENT_ID);

export async function POST({ request }) {
    try {
        const { credential } = await request.json();

        // Verify Google Token
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: PUBLIC_GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();

        if (!payload || !payload.email) {
            return json({ success: false, error: 'Invalid Google token' }, { status: 400 });
        }

        const { email, name, sub: googleId } = payload;
        const spreadsheetId = clean(SPREADSHEET_ID);

        // Check if user exists in Sheets
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${USERS_SHEET_NAME}!A:E`,
        });

        const rows = response.data.values || [];
        const headers = rows[0];
        const users = rows.slice(1).map(row => {
            /** @type {any} */
            const u = {};
            headers.forEach((h, i) => u[h.toLowerCase()] = row[i]);
            return u;
        });

        let user = users.find(u => u.email === email);

        if (!user) {
            // Register new user
            const id = googleId;
            const createdAt = new Date().toISOString();
            // Store password as 'GOOGLE_AUTH' to distinguish
            await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: `${USERS_SHEET_NAME}!A:E`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: [[id, name, email, 'GOOGLE_AUTH', createdAt]]
                }
            });
            user = { id, name, email };
        }

        return json({
            success: true,
            user: { id: user.id, name: user.name, email: user.email }
        });

    } catch (error) {
        console.error('Google Auth API Error:', error);
        return json({ success: false, error: 'Authentication failed' }, { status: 500 });
    }
}
