export default TrackerTemplate;
type TrackerTemplate = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<TrackerConfig>): void;
};
declare const TrackerTemplate: import("svelte").Component<{
    /**
     * - Page title
     */
    title: string;
    /**
     * - Page description
     */
    description: string;
    /**
     * - Body text content (HTML supported)
     */
    bodyText: string;
    /**
     * - Data array
     */
    data: Array<Object>;
    /**
     * - Column names for display
     */
    columns: string[];
    /**
     * - Meta tags configuration
     */
    meta?: Object | undefined;
}, {}, "">;
type TrackerConfig = {
    /**
     * - Page title
     */
    title: string;
    /**
     * - Page description
     */
    description: string;
    /**
     * - Body text content (HTML supported)
     */
    bodyText: string;
    /**
     * - Data array
     */
    data: Array<Object>;
    /**
     * - Column names for display
     */
    columns: string[];
    /**
     * - Meta tags configuration
     */
    meta?: Object | undefined;
};
