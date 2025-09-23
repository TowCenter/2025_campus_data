export default Body;
type Body = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<$$ComponentProps>): void;
};
declare const Body: import("svelte").Component<{
    children: any;
}, {}, "">;
type $$ComponentProps = {
    children: any;
};
