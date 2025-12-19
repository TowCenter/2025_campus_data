export default CardField;
type CardField = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<Props>): void;
};
declare const CardField: import("svelte").Component<{
    /**
     * - Field label
     */
    label: string;
    /**
     * - Slot content for field value
     */
    children?: import("svelte").Snippet<[]> | undefined;
}, {}, "">;
type Props = {
    /**
     * - Field label
     */
    label: string;
    /**
     * - Slot content for field value
     */
    children?: import("svelte").Snippet<[]> | undefined;
};
