export default SummaryStats;
type SummaryStats = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<Props>): void;
};
declare const SummaryStats: import("svelte").Component<{
    /**
     * - Data array
     */
    data?: any[] | undefined;
    /**
     * - Field name in data that contains dates
     */
    dateField?: string | undefined;
    /**
     * - Field name for organization
     */
    orgField?: string | undefined;
}, {}, "">;
type Props = {
    /**
     * - Data array
     */
    data?: any[] | undefined;
    /**
     * - Field name in data that contains dates
     */
    dateField?: string | undefined;
    /**
     * - Field name for organization
     */
    orgField?: string | undefined;
};
