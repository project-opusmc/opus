<script lang="ts">
  import type { Snippet } from "svelte";

  type Variant = "default" | "primary" | "ghost" | "danger";
  type Size = "sm" | "md" | "lg";

  interface Props {
    variant?: Variant;
    size?: Size;
    disabled?: boolean;
    loading?: boolean;
    full?: boolean;
    type?: "button" | "submit";
    class?: string;
    onclick?: (event: MouseEvent) => void;
    children?: Snippet;
  }

  let {
    variant = "default",
    size = "md",
    disabled = false,
    loading = false,
    full = false,
    type = "button",
    class: className = "",
    onclick,
    children,
  }: Props = $props();
</script>

<button
  type={type}
  class="button button--{variant} button--{size} {className}"
  class:button--full={full}
  disabled={disabled || loading}
  aria-busy={loading}
  onclick={onclick}
>
  {#if loading}
    <span class="button__spinner" aria-hidden="true"></span>
  {/if}
  <span class="button__label">
    {@render children?.()}
  </span>
</button>

<style lang="scss">
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-8);
    border-radius: var(--radius-control);
    border: 1px solid var(--border-subtle);
    background: var(--button-background);
    color: var(--text-primary);
    font-weight: 500;
    transition:
      background-color var(--motion-fast) var(--ease-standard),
      border-color var(--motion-fast) var(--ease-standard),
      color var(--motion-fast) var(--ease-standard),
      opacity var(--motion-fast) var(--ease-standard);
    user-select: none;
    white-space: nowrap;
  }

  .button:hover:not(:disabled) {
    background: var(--button-hover-background);
    border-color: var(--border-strong);
  }

  .button:active:not(:disabled) {
    opacity: 0.82;
  }

  .button:disabled {
    opacity: 0.45;
  }

  .button--primary {
    background: var(--button-primary-background);
    border-color: var(--accent);
    color: var(--button-primary-text);
    font-weight: 600;
  }

  .button--primary:hover:not(:disabled) {
    background: var(--text-secondary);
    border-color: var(--text-secondary);
  }

  .button--ghost {
    background: transparent;
    border-color: transparent;
  }

  .button--ghost:hover:not(:disabled) {
    background: var(--panel-hover-background);
    border-color: var(--border-subtle);
  }

  .button--danger {
    background: var(--danger);
    border-color: var(--danger);
    color: #ffffff;
  }

  .button--danger:hover:not(:disabled) {
    background: color-mix(in srgb, var(--danger) 82%, #ffffff);
    border-color: var(--danger);
  }

  .button--sm {
    height: var(--control-height-sm);
    padding: 0 var(--space-12);
    font-size: var(--text-12);
  }

  .button--md {
    height: var(--control-height-md);
    padding: 0 var(--space-16);
    font-size: var(--text-13);
  }

  .button--lg {
    height: var(--control-height-lg);
    padding: 0 var(--space-24);
    font-size: var(--text-14);
  }

  .button--full {
    width: 100%;
  }

  .button__label {
    display: inline-flex;
    align-items: center;
    gap: var(--space-8);
  }

  .button__spinner {
    width: 12px;
    height: 12px;
    border-radius: var(--radius-pill);
    border: 2px solid currentColor;
    border-top-color: transparent;
    animation: opus-spin var(--motion-normal) linear infinite;
  }

  @keyframes opus-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
