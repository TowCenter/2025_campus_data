export default CardContentTemplate;
type CardContentTemplate = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Props): void;
};
declare const CardContentTemplate: import("svelte").Component<Props, {}, "">;
