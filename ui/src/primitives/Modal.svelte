<script lang="ts">
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import IconButton from "./IconButton.svelte";

  interface Props {
    open: boolean;
    title?: string;
    width?: number;
    onclose: () => void;
    children?: Snippet;
    footer?: Snippet;
  }

  let { open, title = "", width = 480, onclose, children, footer }: Props =
    $props();

  function onKeydown(event: KeyboardEvent) {
    if (open && event.key === "Escape") {
      onclose();
    }
  }

  onMount(() => {
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  });
</script>

{#if open}
  <div
    class="modal-backdrop"
    role="presentation"
    onclick={(event) => {
      if (event.target === event.currentTarget) {
        onclose();
      }
    }}
  >
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-label={title || "Opus dialog"}
      style:width={`${width}px`}
      style:max-width="min(92vw, 640px)"
    >
      <header class="modal__header">
        <h2 class="modal__title text-section">{title}</h2>
        <IconButton size="sm" label="Close" onclick={onclose}>
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
      </header>
      <div class="modal__body">
        {@render children?.()}
      </div>
      {#if footer}
        <footer class="modal__footer">
          {@render footer()}
        </footer>
      {/if}
    </div>
  </div>
{/if}

<style lang="scss">
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.62);
    animation: opus-fade-in var(--motion-normal) var(--ease-standard) both;
  }

  .modal {
    display: flex;
    flex-direction: column;
    max-height: min(80vh, 680px);
    border-radius: var(--radius-modal);
    border: 1px solid var(--border-strong);
    background: var(--modal-background);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    animation: opus-modal-in var(--motion-medium) var(--ease-emphasized) both;
    overflow: hidden;
  }

  .modal__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-16);
    padding: var(--space-16) var(--space-20);
    border-bottom: 1px solid var(--border-subtle);
  }

  .modal__title {
    margin: 0;
    color: var(--text-primary);
  }

  .modal__body {
    padding: var(--space-20);
    overflow-y: auto;
  }

  .modal__footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-8);
    padding: var(--space-16) var(--space-20);
    border-top: 1px solid var(--border-subtle);
  }

  @keyframes opus-modal-in {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.985);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>
