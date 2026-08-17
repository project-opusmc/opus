<script lang="ts">
  import type { Snippet } from "svelte";

  type Size = "sm" | "md" | "lg";

  interface Props {
    size?: Size;
    label: string;
    disabled?: boolean;
    class?: string;
    onclick?: (event: MouseEvent) => void;
    children?: Snippet;
  }

  let {
    size = "md",
    label,
    disabled = false,
    class: className = "",
    onclick,
    children,
  }: Props = $props();
</script>

<button
  type="button"
  class="icon-button icon-button--{size} {className}"
  aria-label={label}
  title={label}
  disabled={disabled}
  onclick={onclick}
>
  {@render children?.()}
</button>

<style lang="scss">
  .icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-control);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-secondary);
    transition:
      background-color var(--motion-fast) var(--ease-standard),
      color var(--motion-fast) var(--ease-standard),
      border-color var(--motion-fast) var(--ease-standard);
  }

  .icon-button:hover:not(:disabled) {
    background: var(--panel-hover-background);
    color: var(--text-primary);
    border-color: var(--border-subtle);
  }

  .icon-button:active:not(:disabled) {
    opacity: 0.8;
  }

  .icon-button:disabled {
    opacity: 0.4;
  }

  .icon-button--sm {
    width: var(--control-height-sm);
    height: var(--control-height-sm);
  }

  .icon-button--md {
    width: var(--control-height-md);
    height: var(--control-height-md);
  }

  .icon-button--lg {
    width: var(--control-height-lg);
    height: var(--control-height-lg);
  }
</style>
