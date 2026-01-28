export default SearchCharts;
type SearchCharts = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<Props>): void;
};
declare const SearchCharts: import("svelte").Component<{
    /**
     * - Filtered data array
     */
    data?: any[] | undefined;
    /**
     * - Field name for dates
     */
    dateField?: string | undefined;
    /**
     * - Field name for organization
     */
    orgField?: string | undefined;
    /**
     * - Current search query
     */
    searchQuery?: string | undefined;
    /**
     * - Whether the charts panel is open
     */
    isOpen?: boolean | undefined;
}, {}, "isOpen">;
type Props = {
    /**
     * - Filtered data array
     */
    data?: any[] | undefined;
    /**
     * - Field name for dates
     */
    dateField?: string | undefined;
    /**
     * - Field name for organization
     */
    orgField?: string | undefined;
    /**
     * - Current search query
     */
    searchQuery?: string | undefined;
    /**
     * - Whether the charts panel is open
     */
    isOpen?: boolean | undefined;
};
