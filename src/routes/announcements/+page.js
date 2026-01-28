import { S3_URLS } from '../../config.js';

const parseTolerantJson = (text) => JSON.parse(text.replace(/,\s*([}\]])/g, '$1'));

export const load = async ({ fetch }) => {
	try {
		const response = await fetch(S3_URLS.metadata, { cache: 'no-cache' });
		const text = await response.text();
		const metadata = parseTolerantJson(text);
		return { metadata };
	} catch {
		return { metadata: null };
	}
};
