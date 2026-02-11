<script>
	import Credits from './Credits.svelte';

	let {
		children = undefined,
		hed,
		subhed = '',
		bodyText = '',
		date = '',
		byline = '',
		byline_url = '',
		brand = '',
		dateLabel = 'Last Updated On',
		maintainedBy = [],
		designDevelopment = [],
		acknowledgements = ''
	} = $props();

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
                    {@html subhed}
                </p>
            </span>
            {/if}

            {#if bodyText}
            <div class="body-text-description">
                {@html bodyText}
            </div>
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

				<Credits
					{maintainedBy}
					{designDevelopment}
					{acknowledgements}
				/>
            </div>
        </header>
    </div>

<style>
    /* Ensure container-lg padding matches Body component on mobile */
    @media (max-width: 767px) {
        .container-lg.title-image-lg {
            padding-left: 0;
            padding-right: 0;
        }
        header.col-sm-10 {
            padding-left: 1rem !important;
            padding-right: 1rem !important;
        }
    }
    @media screen and (min-width: 768px) and (max-width: 1024px) {
        header.col-sm-10 {
            padding-left: 1.5rem !important;
            padding-right: 1.5rem !important;
        }
    }

    .meta .update-date {
        font-family: 'Lyon Text Web', 'Georgia', serif;
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

    @media screen and (max-width: 767px) {
        .meta .update-date {
            font-size: 18px;
            line-height: 1.6;
        }
    }

    .body-text-description {
        font-family: 'Lyon Text Web', 'Georgia', serif;
        font-size: 20px;
        line-height: 28px;
        color: #222222;
        margin: 1.5rem 0;
        font-style: normal;
        font-weight: 400;
    }

    .body-text-description b {
        font-weight: 700;
    }
</style>
