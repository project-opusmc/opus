<script lang="ts">
  import type { Snippet } from "svelte";

  type Tone = "neutral" | "success" | "warning" | "danger" | "accent";

  interface Props {
    tone?: Tone;
    class?: string;
    children?: Snippet;
  }

  let { tone = "neutral", class: className = "", children }: Props = $props();
</script>

<span class="badge badge--{tone} {className}">
  {@render children?.()}
</span>

<style lang="scss">
  .badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-4);
    height: 20px;
    padding: 0 var(--space-8);
    border-radius: var(--radius-pill);
    border: 1px solid var(--border-subtle);
    background: var(--surface-2);
    color: var(--text-secondary);
    font-size: var(--text-11);
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
  }

  .badge--neutral {
    color: var(--text-secondary);
  }

  .badge--success {
    color: var(--success);
    border-color: color-mix(in srgb, var(--success) 30%, transparent);
  }

  .badge--warning {
    color: var(--warning);
    border-color: color-mix(in srgb, var(--warning) 30%, transparent);
  }

  .badge--danger {
    color: var(--danger);
    border-color: color-mix(in srgb, var(--danger) 30%, transparent);
  }

  .badge--accent {
    color: var(--accent);
    border-color: var(--border-strong);
  }
</style>
