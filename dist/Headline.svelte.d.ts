export default Headline;
type Headline = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<$$ComponentProps>): void;
};
declare const Headline: import("svelte").Component<{
    children: any;
    hed: any;
    subhed: any;
    date: any;
    byline_url: any;
    byline: any;
}, {}, "">;
type $$ComponentProps = {
    children: any;
    hed: any;
    subhed: any;
    date: any;
    byline_url: any;
    byline: any;
};
