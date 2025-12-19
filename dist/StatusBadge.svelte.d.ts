export default StatusBadge;
type StatusBadge = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<Props>): void;
};
declare const StatusBadge: import("svelte").Component<{
    /**
     * - Status text
     */
    status: string;
    /**
     * - Search query for highlighting
     */
    searchQuery?: string | undefined;
}, {}, "">;
type Props = {
    /**
     * - Status text
     */
    status: string;
    /**
     * - Search query for highlighting
     */
    searchQuery?: string | undefined;
};
