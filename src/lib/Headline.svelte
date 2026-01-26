<script>
	let { children = undefined, hed, subhed = '', date = '', byline = '', byline_url = '', brand = '', dateLabel = 'Last Updated On' } = $props();

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

            <div class="meta">
                {#if date && date !== 'Date unavailable'}
                <span class="date update-date">
                    <em>{dateLabel}</em>
                    <strong>{date}</strong>
                </span>
                {/if}
                {#if byline}
                <span class="byline"
                    ><a href={byline_url}
                        >{byline}</a
                    ></span
                >
                {/if}
            </div>
        </header>
    </div>

<style>
    /* Ensure container-lg padding matches Body component on mobile */
    @media (max-width: 767.98px) {
        .container-lg.title-image-lg {
            padding-left: 0;
            padding-right: 0;
        }
    }

    /* Increase left padding for title on mobile */
    @media screen and (max-width: 768px) {
        header.col-sm-10 {
            padding-left: 1.5rem !important;
        }
    }

    .meta .update-date {
        font-family: "Lyon Text Web", 'Georgia', serif;
        font-size: 20px;
        line-height: 28px;
        font-weight: normal;
        color: #222222;
        text-transform: none;
        display: block;
        margin-top: 0;
        margin-left: 0;
        letter-spacing: 0;
    }

    .meta .update-date em {
        font-style: italic;
        color: #000000;
    }

    .meta .update-date strong {
        font-weight: bold;
    }

    @media screen and (max-width: 768px) {
        .meta .update-date {
            font-size: 18px;
            line-height: 1.6;
        }
    }
</style>
