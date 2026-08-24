<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title?: string;
    disabled?: boolean;
    secondary?: boolean;
    onclick?: () => void;
    children?: Snippet;
  }

  let { title = "", disabled = false, secondary = false, onclick, children }: Props =
    $props();
</script>

<button
  class="button-setting"
  class:secondary
  type="button"
  {disabled}
  onclick={() => onclick?.()}
>
  {#if children}{@render children()}{:else}{title}{/if}
</button>

<style lang="scss">
  @use "../../design/mixins.scss" as *;

  .button-setting {
    position: relative;
    border: none;
    background-color: var(--menu-button-background-color);
    color: var(--menu-text-color);
    font-family: var(--font-family);
    padding: 14px 20px;
    border-radius: var(--radius-control);
    font-size: 15px;
    font-weight: 500;
    white-space: nowrap;
    transition: background-color 0.2s ease, opacity 0.2s ease;

    &.secondary { background-color: var(--menu-button-secondary-background-color); }

    &:not([disabled]) {
      @include hover {
        background-color: var(--menu-button-hover-background-color);
        cursor: pointer;

        &.secondary { background-color: var(--menu-button-secondary-hover-background-color); }
      }
    }

    &[disabled] { opacity: 0.6; }
  }
</style>
