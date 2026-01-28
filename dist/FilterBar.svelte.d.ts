export default FilterBar;
type FilterBar = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<Props>): void;
};
declare const FilterBar: import("svelte").Component<{
    /**
     * - Data array
     */
    data?: any[] | undefined;
    /**
     * - Filter configuration
     */
    filterConfig?: {
        /**
         * - Filter type
         */
        type: "multi-select" | "hierarchical" | "date-range" | "search";
        /**
         * - Column name (display name)
         */
        column?: string | undefined;
        /**
         * - Display label
         */
        label: string;
        /**
         * - Data key (if different from column)
         */
        dataKey?: string | undefined;
    }[] | undefined;
    /**
     * - Current filter values (keyed by filter ID)
     */
    filterValues?: Record<string, any> | undefined;
    /**
     * - Search query
     */
    searchQuery?: string | undefined;
    /**
     * - Number of filtered rows
     */
    filteredRowCount?: number | undefined;
    /**
     * - Category definitions
     */
    categoryDefinitions?: Record<string, string> | undefined;
    /**
     * - Whether filter bar is sticky
     */
    isSticky?: boolean | undefined;
    /**
     * - Filter change handler
     */
    onFilterChange?: ((filterId: string, value: any) => void) | undefined;
    /**
     * - CSV download handler
     */
    onDownloadCSV?: (() => void) | undefined;
}, {}, "">;
type Props = {
    /**
     * - Data array
     */
    data?: any[] | undefined;
    /**
     * - Filter configuration
     */
    filterConfig?: {
        /**
         * - Filter type
         */
        type: "multi-select" | "hierarchical" | "date-range" | "search";
        /**
         * - Column name (display name)
         */
        column?: string | undefined;
        /**
         * - Display label
         */
        label: string;
        /**
         * - Data key (if different from column)
         */
        dataKey?: string | undefined;
    }[] | undefined;
    /**
     * - Current filter values (keyed by filter ID)
     */
    filterValues?: Record<string, any> | undefined;
    /**
     * - Search query
     */
    searchQuery?: string | undefined;
    /**
     * - Number of filtered rows
     */
    filteredRowCount?: number | undefined;
    /**
     * - Category definitions
     */
    categoryDefinitions?: Record<string, string> | undefined;
    /**
     * - Whether filter bar is sticky
     */
    isSticky?: boolean | undefined;
    /**
     * - Filter change handler
     */
    onFilterChange?: ((filterId: string, value: any) => void) | undefined;
    /**
     * - CSV download handler
     */
    onDownloadCSV?: (() => void) | undefined;
};
