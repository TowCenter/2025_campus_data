<script>
	/**
	 * @typedef {Object} Props
	 * @property {string} [searchQuery=''] - Current search query
	 * @property {(query: string) => void} [onSearchChange=() => {}] - Callback when search changes
	 */

	/** @type {Props} */
	let { 
		searchQuery = '',
		onSearchChange = () => {}
	} = $props();

	const inputId = `search-input-${Math.random().toString(36).substr(2, 9)}`;

	const exampleSearches = [
		{ label: 'antisemitism', query: 'antisemitism' },
		{ label: 'ICE', query: '"Immigration and Customs Enforcement"' },
		{ label: 'visa', query: 'visa' },
		{ label: 'funding cut', query: '"funding cut"' },
		{ label: 'Office of Civil Rights', query: '"Office of Civil Rights"' }
	];

	function handleClear() {
		onSearchChange('');
	}

	function handleExampleClick(example) {
		onSearchChange(example.query);
	}
</script>

<div class="search-group search-bar-container">
	<div class="label-with-help">
		<label for={inputId}>Search</label>
		<div class="search-help">
			<button
				class="search-help-btn"
				type="button"
				aria-label="Search help"
				aria-describedby="search-help-tooltip"
				data-umami-event="search-help-click"
			>
				?
			</button>
			<div class="search-help-tooltip" role="tooltip" id="search-help-tooltip">
				<p><strong>Single or multiple words</strong>: search with one word or several words; results rank higher when more of your words appear; multi-word searches do not require the words to appear together or in order.</p>
				<p><strong>Exact phrase</strong>: use double quotes ("") to match exact wording, for example "campus safety"; note that it may take longer to process.</p>
			</div>
		</div>
	</div>
	<div class="search-box-inline">
		<input
			id={inputId}
			type="text"
			placeholder='e.g., "exact phrase" OR word1 word2 AND word3'
			value={searchQuery}
			oninput={(e) => onSearchChange(e.target.value)}
			class="search-input"
			aria-label="Search by keyword using AND/OR operators"
		/>
		{#if searchQuery}
			<button 
				class="clear-btn" 
				onclick={handleClear}
				aria-label="Clear search"
				type="button"
			>
				✕
			</button>
		{/if}
	</div>
	<div class="example-searches">
		<span class="example-label">Example searches:</span>
		{#each exampleSearches as example}
			<button
				class="example-link"
				onclick={() => handleExampleClick(example)}
				type="button"
			>
				{example.label}
			</button>
		{/each}
	</div>
</div>

<style>
	.search-bar-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		flex: 1;
		min-width: 0;
	}

	.label-with-help {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.search-group label {
		font-weight: 400;
		font-size: 0.7rem;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin: 0;
	}

	.search-help {
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-help-btn {
		width: 16px;
		height: 16px;
		min-width: 16px;
		border-radius: 50%;
		background-color: transparent;
		border: 1.5px solid #999;
		color: #666;
		font-size: 0.7rem;
		font-weight: 600;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		padding: 0;
		margin: 0;
		line-height: 1;
		font-style: italic;
	}

	.search-help-btn:hover {
		background-color: #f0f0f0;
		border-color: #254c6f;
		color: #254c6f;
	}

	.search-help-tooltip {
		position: absolute;
		left: 0;
		bottom: calc(100% + 8px);
		width: 260px;
		background: white;
		border: 1px solid #e0e0e0;
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
		padding: 0.75rem 0.85rem;
		font-size: 0.8rem;
		line-height: 1.4;
		color: #333;
		opacity: 0;
		transform: translateY(6px);
		pointer-events: none;
		transition: opacity 0.15s ease, transform 0.15s ease;
		z-index: 10;
	}

	.search-help-tooltip p {
		margin: 0 0 0.5rem;
	}

	.search-help-tooltip p:last-child {
		margin-bottom: 0;
	}

	.search-help:hover .search-help-tooltip,
	.search-help:focus-within .search-help-tooltip {
		opacity: 1;
		transform: translateY(0);
		pointer-events: auto;
	}

	.search-box-inline {
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-box-inline .search-input {
		width: 100%;
		padding-right: 2.5rem;
	}

	.search-box-inline .clear-btn {
		position: absolute;
		right: 0.75rem;
	}

	.search-input {
		width: 100%;
		padding: 0.6rem 2.5rem 0.6rem 0.8rem;
		font-size: 0.95rem;
		border: 1px solid #ccc;
		border-radius: 0;
		font-family: inherit;
		color: #1a1a1a;
	}

	.search-input::placeholder {
		color: #999;
		opacity: 1;
	}

	.search-input:focus {
		outline: none;
		border-color: #666;
		box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.05);
	}

	.clear-btn {
		background: none;
		border: none;
		font-size: 1.2rem;
		cursor: pointer;
		color: #999;
		padding: 0.25rem;
	}

	.clear-btn:hover {
		color: #333;
	}

	.example-searches {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
		margin-top: 0.5rem;
	}

	.example-label {
		font-size: 0.7rem;
		color: #666;
		font-weight: 400;
	}

	.example-link {
		background: none;
		border: none;
		padding: 0;
		font-size: 0.7rem;
		color: #254c6f;
		text-decoration: underline;
		cursor: pointer;
		font-family: inherit;
		transition: color 0.2s ease;
	}

	.example-link:hover {
		color: #1a3a52;
	}

	@media screen and (max-width: 768px) {
		.search-bar-container {
			width: 100%;
		}

		.search-group label {
			font-size: 0.75rem;
		}

		.search-input {
			font-size: 16px; /* Prevents zoom on iOS */
			padding: 0.75rem 2.5rem 0.75rem 1rem;
			min-height: 44px;
		}

		.clear-btn {
			width: 32px;
			height: 32px;
			min-width: 32px;
			min-height: 32px;
			padding: 0.25rem;
			touch-action: manipulation;
		}

		.example-searches {
			font-size: 0.7rem;
			gap: 0.35rem;
		}

		.example-link {
			font-size: 0.7rem;
			padding: 0.25rem 0;
			min-height: 32px;
			touch-action: manipulation;
		}

		.search-help-btn {
			width: 20px;
			height: 20px;
			min-width: 20px;
			min-height: 20px;
			touch-action: manipulation;
		}
	}
</style>
