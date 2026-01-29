import { URLS, fetchTolerantJson } from '$lib/config/s3.js';

export const prerender = true;

export const load = async ({ fetch }) => {
	try {
		const metadata = await fetchTolerantJson(URLS.metadata, { fetch });
		return { metadata };
	} catch {
		return { metadata: null };
	}
};
