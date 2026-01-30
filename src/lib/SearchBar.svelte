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
		{ label: 'funding cut', query: '"funding cut"' },
		{ label: 'ICE', query: '"Immigration and Customs Enforcement"' },
		{ label: 'Office of Civil Rights', query: '"Office of Civil Rights"' },
		{ label: 'visa', query: 'visa' },
		{ label: 'antisemitism', query: 'antisemitism' }
	];

	function handleClear() {
		onSearchChange('');
	}

	function handleExampleClick(example) {
		onSearchChange(example.query);
	}
</script>

<div class="search-group search-bar-container">
	<label for={inputId}>Search</label>
	<div class="search-box-inline">
		<input
			id={inputId}
			type="text"
			placeholder="Search by keyword..."
			value={searchQuery}
			oninput={(e) => onSearchChange(e.target.value)}
			class="search-input"
			aria-label="Search by keyword"
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

	.search-group label {
		font-weight: 400;
		font-size: 0.7rem;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
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
		gap: 0.5rem;
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

		.search-input {
			font-size: 16px; /* Prevents zoom on iOS */
		}

		.example-searches {
			font-size: 0.65rem;
		}
	}
</style>
