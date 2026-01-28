export default BarChart;
type BarChart = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<Props>): void;
};
declare const BarChart: import("svelte").Component<{
    /**
     * - Data array
     */
    data?: any[] | undefined;
    /**
     * - Field name in data that contains dates
     */
    dateField?: string | undefined;
    /**
     * - Maximum number of bars to show (most recent periods)
     */
    maxBars?: number | undefined;
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
     * - Maximum number of bars to show (most recent periods)
     */
    maxBars?: number | undefined;
};
