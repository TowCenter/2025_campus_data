export default InteractionTag;
type InteractionTag = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<Props>): void;
};
declare const InteractionTag: import("svelte").Component<{
    /**
     * - Type of interaction (lawsuit, deal, grant)
     */
    interactionType: string;
}, {}, "">;
type Props = {
    /**
     * - Type of interaction (lawsuit, deal, grant)
     */
    interactionType: string;
};
