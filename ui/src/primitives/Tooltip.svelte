<script lang="ts">
  import type { Snippet } from "svelte";

  type Placement = "top" | "bottom" | "left" | "right";

  interface Props {
    content: string;
    placement?: Placement;
    class?: string;
    children?: Snippet;
  }

  let { content, placement = "top", class: className = "", children }: Props =
    $props();
</script>

<span class="tooltip-host {className}">
  {@render children?.()}
  <span
    class="tooltip tooltip--{placement}"
    role="tooltip"
  >
    {content}
  </span>
</span>

<style lang="scss">
  .tooltip-host {
    position: relative;
    display: inline-flex;
  }

  .tooltip {
    position: absolute;
    z-index: 200;
    max-width: 260px;
    padding: var(--space-8) var(--space-12);
    border-radius: var(--radius-control);
    border: 1px solid var(--border-strong);
    background: var(--surface-3);
    color: var(--text-primary);
    font-size: var(--text-11);
    font-weight: 400;
    line-height: 1.4;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transform: scale(0.96);
    transition:
      opacity var(--motion-fast) var(--ease-standard),
      transform var(--motion-fast) var(--ease-standard);
  }

  .tooltip-host:hover .tooltip,
  .tooltip-host:focus-within .tooltip {
    opacity: 1;
    transform: scale(1);
  }

  .tooltip--top {
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%) scale(0.96);
  }

  .tooltip-host:hover .tooltip--top {
    transform: translateX(-50%) scale(1);
  }

  .tooltip--bottom {
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%) scale(0.96);
  }

  .tooltip-host:hover .tooltip--bottom {
    transform: translateX(-50%) scale(1);
  }

  .tooltip--left {
    right: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%) scale(0.96);
  }

  .tooltip-host:hover .tooltip--left {
    transform: translateY(-50%) scale(1);
  }

  .tooltip--right {
    left: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%) scale(0.96);
  }

  .tooltip-host:hover .tooltip--right {
    transform: translateY(-50%) scale(1);
  }
</style>
