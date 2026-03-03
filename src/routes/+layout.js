import { URLS, fetchTolerantJson } from '$lib/config/s3.js';

export const prerender = true;

export const load = async ({ fetch }) => {
	try {
		const metadata = await fetchTolerantJson(URLS.metadata, { fetch });
		return { metadata: { ...metadata, completed_at: '2026-03-02T00:00:00-05:00' } };
	} catch {
		return { metadata: null };
	}
};
