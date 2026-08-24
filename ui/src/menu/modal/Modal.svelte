<script lang="ts">
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import Icon from "../Icon.svelte";

  interface Props {
    title: string;
    visible?: boolean;
    onclose?: () => void;
    children?: Snippet;
  }

  let { title, visible = $bindable(false), onclose, children }: Props = $props();

  function close() {
    visible = false;
    onclose?.();
  }

  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      if (visible && event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
</script>

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-wrapper"
    onclick={(event) => {
      if (event.target === event.currentTarget) close();
    }}
  >
    <div class="modal" role="dialog" aria-modal="true" aria-label={title}>
      <button class="modal-close" type="button" onclick={close} aria-label="Close">
        <Icon name="close" size={18} />
      </button>

      <div class="modal-title">{title}</div>

      <div class="modal-content">
        {@render children?.()}
      </div>
    </div>
  </div>
{/if}

<style lang="scss">
  .modal-wrapper {
    position: fixed;
    inset: 0;
    background-color: var(--menu-modal-backdrop-color);
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: opus-fade-in var(--motion-normal) var(--ease-standard) both;
  }

  .modal {
    background-color: var(--menu-modal-background-color);
    min-width: 460px;
    max-width: min(92vw, 620px);
    padding: 34px;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-control);
    box-shadow: 0 0 24px var(--menu-modal-shadow-color);
    position: relative;
  }

  .modal-title {
    color: var(--menu-text-color);
    font-size: 28px;
    font-weight: 600;
    position: relative;
    width: max-content;
    align-self: center;
    margin-bottom: 50px;

    &::after {
      content: "";
      position: absolute;
      display: block;
      height: 6px;
      width: 90%;
      background-color: var(--menu-modal-title-accent-color);
      bottom: -18px;
      left: 50%;
      transform: translateX(-50%);
      border-radius: var(--radius-pill);
    }
  }

  .modal-content {
    display: flex;
    flex-direction: column;
    row-gap: 24px;
  }

  .modal-close {
    height: 36px;
    width: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: transparent;
    border: solid 2px var(--menu-modal-close-border-color);
    border-radius: 50%;
    cursor: pointer;
    top: 18px;
    right: 18px;
    position: absolute;
    color: var(--menu-text-color);
    transition: background-color 0.2s ease;

    &:hover { background-color: var(--menu-modal-close-hover-background-color); }
  }
</style>
