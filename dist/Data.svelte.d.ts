export default Data;
type Data = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<Props>): void;
};
declare const Data: import("svelte").Component<{
    /**
     * - Data array
     */
    data?: any[] | undefined;
    /**
     * - Category definitions
     */
    categoryDefinitions?: Record<string, string> | undefined;
    /**
     * - Custom filter configuration (optional, uses default if not provided)
     */
    filterConfig?: {
        /**
         * - Filter type
         */
        type: "multi-select" | "hierarchical" | "date-range" | "search";
        /**
         * - Column name (display name) - required for multi-select, optional for search/date-range
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
        /**
         * - Parent column for hierarchical filters
         */
        parentColumn?: string | undefined;
        /**
         * - Child column for hierarchical filters
         */
        childColumn?: string | undefined;
    }[] | undefined;
    /**
     * - Field name in data that contains dates
     */
    dateField?: string | undefined;
    /**
     * - Initial number of items to show
     */
    initialVisibleCount?: number | undefined;
    /**
     * - Component to render each item (optional, uses slot if not provided)
     */
    itemComponent?: any;
    /**
     * - Display mode: 'list', 'table', 'grid', etc. (for styling purposes)
     */
    displayMode?: string | undefined;
    /**
     * - Whether to show timeline UI with date grouping
     */
    showTimeline?: boolean | undefined;
    /**
     * - Whether to show year navigation sidebar
     */
    showYearNavigation?: boolean | undefined;
    /**
     * - Slot content for custom item rendering
     */
    children?: ((args: {
        item: any;
        index: number;
        searchQuery: string;
        filterValues: Record<string, any>;
    }) => any) | undefined;
}, {}, "">;
type Props = {
    /**
     * - Data array
     */
    data?: any[] | undefined;
    /**
     * - Category definitions
     */
    categoryDefinitions?: Record<string, string> | undefined;
    /**
     * - Custom filter configuration (optional, uses default if not provided)
     */
    filterConfig?: {
        /**
         * - Filter type
         */
        type: "multi-select" | "hierarchical" | "date-range" | "search";
        /**
         * - Column name (display name) - required for multi-select, optional for search/date-range
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
        /**
         * - Parent column for hierarchical filters
         */
        parentColumn?: string | undefined;
        /**
         * - Child column for hierarchical filters
         */
        childColumn?: string | undefined;
    }[] | undefined;
    /**
     * - Field name in data that contains dates
     */
    dateField?: string | undefined;
    /**
     * - Initial number of items to show
     */
    initialVisibleCount?: number | undefined;
    /**
     * - Component to render each item (optional, uses slot if not provided)
     */
    itemComponent?: any;
    /**
     * - Display mode: 'list', 'table', 'grid', etc. (for styling purposes)
     */
    displayMode?: string | undefined;
    /**
     * - Whether to show timeline UI with date grouping
     */
    showTimeline?: boolean | undefined;
    /**
     * - Whether to show year navigation sidebar
     */
    showYearNavigation?: boolean | undefined;
    /**
     * - Slot content for custom item rendering
     */
    children?: ((args: {
        item: any;
        index: number;
        searchQuery: string;
        filterValues: Record<string, any>;
    }) => any) | undefined;
};
