<script lang="ts">
  import Icon from "./Icon.svelte";

  interface Props {
    value?: string;
    placeholder?: string;
    onsearch?: (query: string) => void;
  }

  let { value = $bindable(""), placeholder = "Search...", onsearch }: Props =
    $props();
</script>

<div class="search">
  <span class="search__icon"><Icon name="search" size={18} /></span>
  <input
    class="search__input"
    type="text"
    {placeholder}
    bind:value
    spellcheck="false"
    oninput={() => onsearch?.(value)}
  />
</div>

<style lang="scss">
  .search {
    position: relative;
    display: flex;
    align-items: center;
    background-color: var(--menu-search-background-color);
    border-radius: var(--radius-control);
    border-bottom: solid 3px var(--menu-search-border-color);
    flex: 1;
  }

  .search__icon {
    position: absolute;
    left: 16px;
    display: flex;
    color: var(--menu-text-color);
    pointer-events: none;
  }

  .search__input {
    background: transparent;
    border: none;
    color: var(--menu-text-color);
    font-family: var(--font-family);
    font-size: 15px;
    padding: 14px 16px 14px 46px;
    width: 100%;

    &::placeholder {
      color: color-mix(in srgb, var(--menu-text-color) 45%, transparent);
    }
  }
</style>
