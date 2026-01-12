import { json } from '@sveltejs/kit';
import { google } from 'googleapis';
import {
    GOOGLE_CLIENT_EMAIL,
    GOOGLE_PRIVATE_KEY,
    SPREADSHEET_ID
} from '$env/static/private';

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

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: clean(GOOGLE_CLIENT_EMAIL),
        private_key: clean(GOOGLE_PRIVATE_KEY),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const STATS_SHEET_NAME = 'BusinessStats';

/** @param {string} spreadsheetId */
async function ensureStatsSheetExists(spreadsheetId) {
    try {
        const meta = await sheets.spreadsheets.get({ spreadsheetId });
        const sheetExists = meta.data.sheets?.some(s => s.properties?.title === STATS_SHEET_NAME);

        if (!sheetExists) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [{
                        addSheet: {
                            properties: { title: STATS_SHEET_NAME }
                        }
                    }]
                }
            });

            // Initialize with headers
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${STATS_SHEET_NAME}!A1:D1`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: [['Timestamp', 'Business ID', 'Business Name', 'Action']]
                }
            });
        }
    } catch (error) {
        console.error('Error ensuring stats sheet exists:', error);
    }
}

export async function POST({ request }) {
    try {
        const { businessId, businessName, action } = await request.json();
        const spreadsheetId = clean(SPREADSHEET_ID);

        await ensureStatsSheetExists(spreadsheetId);

        const timestamp = new Date().toISOString();

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${STATS_SHEET_NAME}!A:D`,
            valueInputOption: 'RAW',
            requestBody: {
                values: [[timestamp, businessId, businessName, action]]
            }
        });

        return json({ success: true });
    } catch (error) {
        console.error('Stats API Error:', error);
        return json({ success: false, error: 'Failed to log stats' }, { status: 500 });
    }
}
