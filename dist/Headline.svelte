<script>
	let { children, hed, subhed, date, byline1, byline1_url, byline2, byline2_url, brand } = $props();

</script>

    <div class="container-lg title-image-lg">
        {#if children}
            {@render children()}
        {/if}

        <header class="col-sm-10">
            {#if brand}
                <div class="brand-title">{brand}</div>
            {/if}
            <h1 class="main-title">{hed}</h1>

            {#if subhed}
            <span class="post-excerpt"
                ><p>
                    {subhed}
                </p>
            </span>
            {/if}

            {#if byline1 || byline2}
            <div class="meta">
                <span class="byline"
                    ><em>By</em>
                    {#if byline1}
                        {#if byline1_url}
                        <a href={byline1_url}>{byline1}</a>
                        {:else}
                        {byline1}
                        {/if}
                    {/if}
                    {#if byline1 && byline2} and {/if}
                    {#if byline2}
                        {#if byline2_url}
                        <a href={byline2_url}>{byline2}</a>
                        {:else}
                        {byline2}
                        {/if}
                    {/if}
                    </span
                >
            </div>
            {/if}
        </header>
    </div>
