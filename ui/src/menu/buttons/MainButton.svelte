<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "../Icon.svelte";

  interface Props {
    title: string;
    icon: string;
    subtitle?: string;
    active?: boolean;
    onclick?: () => void;
    children?: Snippet<[{ parentHovered: boolean }]>;
  }

  let { title, icon, subtitle = "", active = false, onclick, children }: Props =
    $props();

  let hovered = $state(false);
</script>

<!-- The signature LiquidBounce main button: a wide pill whose accent fills in
     from the right on hover while the round icon inverts. Recreated here with
     our own markup + tokens. -->
<button
  type="button"
  class="main-button"
  class:is-active={active}
  onmouseenter={() => (hovered = true)}
  onmouseleave={() => (hovered = false)}
  onclick={() => onclick?.()}
>
  <span class="icon">
    <Icon name={icon} size={25} />
  </span>

  <span class="labels">
    <span class="title">{title}</span>
    {#if subtitle}
      <span class="subtitle">{subtitle}</span>
    {/if}
  </span>

  <span class="wrapped">
    {@render children?.({ parentHovered: hovered })}
  </span>
</button>

<style lang="scss">
  @use "../../design/mixins.scss" as *;

  .main-button {
    position: relative;
    background-color: var(--menu-main-button-background-color);
    width: 100%;
    max-width: 440px;
    padding: 15px 20px;
    display: grid;
    grid-template-columns: max-content 1fr max-content;
    align-items: center;
    cursor: pointer;
    border: none;
    border-radius: var(--radius-control);
    column-gap: 18px;

    background: linear-gradient(
      to left,
      var(--menu-main-button-background-color) 50%,
      var(--menu-main-button-accent-color) 50%
    );
    background-size: 200% 100%;
    background-position: right bottom;
    will-change: background-position;
    transition: background-position 0.2s ease-out;

    @include hover {
      background-position: left bottom;

      .icon {
        background-color: var(--menu-main-button-icon-hover-background-color);
        color: var(--menu-main-button-icon-hover-foreground-color);
      }
    }
  }

  .icon {
    background-color: var(--menu-main-button-icon-background-color);
    color: var(--menu-main-button-icon-foreground-color);
    width: 52px;
    height: 52px;
    border-radius: 50%;
    transition: background-color 0.2s ease, color 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
  }

  .labels {
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: left;
    min-width: 0;
  }

  .title {
    font-size: 18px;
    color: var(--menu-main-button-text-color);
    font-weight: 600;
    line-height: 1.15;
  }

  .subtitle {
    font-size: 12.5px;
    font-weight: 500;
    color: color-mix(in srgb, var(--menu-text-color) 60%, transparent);
  }

  .wrapped {
    display: flex;
    align-items: center;
    gap: 12px;
    justify-self: end;
  }

  @media (max-height: 600px) {
    .main-button {
      max-width: none;
      min-height: 58px;
      padding: 8px 12px;
      column-gap: 10px;
    }

    .icon { width: 38px; height: 38px; }
    .title { font-size: 15px; }
    .subtitle { font-size: 11px; }
  }

  @media (max-height: 400px) {
    .main-button {
      min-height: 44px;
      padding: 5px 8px;
      column-gap: 8px;
    }

    .icon { width: 30px; height: 30px; }
    .title { font-size: 13px; }
    .subtitle { font-size: 10px; }
  }
</style>
