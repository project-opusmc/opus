<script lang="ts">
  import IconButton from "./IconButton.svelte";

  interface Props {
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    class?: string;
  }

  let {
    value = $bindable(""),
    placeholder = "Search",
    disabled = false,
    class: className = "",
  }: Props = $props();
</script>

<div class="search-input {className}">
  <svg
    class="search-input__icon"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="7"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
  <input
    class="search-input__field"
    type="search"
    bind:value
    {placeholder}
    {disabled}
  />
  {#if value}
    <IconButton
      size="sm"
      label="Clear search"
      onclick={() => (value = "")}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </IconButton>
  {/if}
</div>

<style lang="scss">
  .search-input {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    height: var(--control-height-md);
    padding: 0 var(--space-12);
    border-radius: var(--radius-control);
    border: 1px solid var(--border-subtle);
    background: var(--input-background);
    transition: border-color var(--motion-fast) var(--ease-standard);
  }

  .search-input:focus-within {
    border-color: var(--accent);
  }

  .search-input__icon {
    color: var(--text-muted);
    flex: none;
  }

  .search-input__field {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--text-primary);
    font-size: var(--text-13);
  }

  .search-input__field::placeholder {
    color: var(--text-muted);
  }
</style>
