export default Headline;
type Headline = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<$$ComponentProps>): void;
};
declare const Headline: import("svelte").Component<{
    children?: any;
    hed: any;
    subhed?: string;
    date?: string;
    byline?: string;
    byline_url?: string;
    brand?: string;
    dateLabel?: string;
    maintainedBy?: any[];
    designDevelopment?: any[];
    acknowledgements?: string;
}, {}, "">;
type $$ComponentProps = {
    children?: any;
    hed: any;
    subhed?: string;
    date?: string;
    byline?: string;
    byline_url?: string;
    brand?: string;
    dateLabel?: string;
    maintainedBy?: any[];
    designDevelopment?: any[];
    acknowledgements?: string;
};
