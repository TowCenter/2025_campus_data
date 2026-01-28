export default YearNavigation;
type YearNavigation = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<Props>): void;
};
declare const YearNavigation: import("svelte").Component<{
    /**
     * - Filtered data grouped by date key
     */
    groupedData?: Record<string, any[]> | undefined;
    /**
     * - All data (unfiltered) to show all years/months
     */
    allData?: any[] | undefined;
    /**
     * - Callback when year is clicked
     */
    onYearClick?: ((year: number) => void) | undefined;
}, {}, "">;
type Props = {
    /**
     * - Filtered data grouped by date key
     */
    groupedData?: Record<string, any[]> | undefined;
    /**
     * - All data (unfiltered) to show all years/months
     */
    allData?: any[] | undefined;
    /**
     * - Callback when year is clicked
     */
    onYearClick?: ((year: number) => void) | undefined;
};
