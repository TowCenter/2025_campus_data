<script>
	let { children, hed, subhed, date, byline_url, byline } = $props();

</script>

    <div class="container-lg title-image-lg">
        {#if children}
            {@render children()}
        {/if}

        <header class="col-sm-10">
            <h1 class="main-title">{hed}</h1>

            <span class="post-excerpt"
                ><p>
                    {subhed}
                </p>
            </span>

            <div class="meta">
                <span class="date">
                    <em>Last Updated On</em>
                    {date}</span>
                <span class="byline"
                    ><em>Maintained By</em>
                    <a href={byline_url}
                        >{byline}</a
                    ></span
                >
            </div>
        </header>
    </div>
