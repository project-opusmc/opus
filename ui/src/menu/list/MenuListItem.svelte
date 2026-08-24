<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    // Optional square preview (world/server icon). When absent we render an
    // accent monogram from the title so the row still has a strong left anchor.
    image?: string | null;
    imageText?: string | null;
    imageTextColor?: string | null;
    ondblclick?: () => void;
    subtitle?: Snippet;
    tag?: Snippet;
    activeVisible?: Snippet;
    alwaysVisible?: Snippet;
  }

  let {
    title,
    image = null,
    imageText = null,
    imageTextColor = null,
    ondblclick,
    subtitle,
    tag,
    activeVisible,
    alwaysVisible,
  }: Props = $props();

  let monogram = $derived(title.trim().slice(0, 1).toUpperCase() || "?");
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="menu-list-item" ondblclick={() => ondblclick?.()}>
  <div class="image">
    {#if image}
      <img class="preview" src={image} alt="" />
    {:else}
      <span class="preview preview--mono">{monogram}</span>
    {/if}
    {#if imageText}
      <span class="image-text" style={`background-color:${imageTextColor ?? "var(--menu-base-68-color)"};`}>
        {imageText}
      </span>
    {/if}
  </div>

  <div class="title">
    <span class="title-text">{title}</span>
    {@render tag?.()}
  </div>

  <div class="subtitle">
    {@render subtitle?.()}
  </div>

  <div class="buttons">
    <div class="active">
      {@render activeVisible?.()}
    </div>
    {@render alwaysVisible?.()}
  </div>
</div>

<style lang="scss">
  @use "../../design/mixins.scss" as *;

  .menu-list-item {
    display: grid;
    grid-template-areas:
      "a b c"
      "a d c";
    grid-template-columns: max-content 1fr max-content;
    background-color: var(--menu-list-item-background-color);
    padding: 12px 20px;
    column-gap: 15px;
    border-radius: var(--radius-control);
    align-items: center;

    @include hover {
      background-color: var(--menu-list-item-hover-background-color);

      .subtitle { color: var(--menu-list-item-hover-subtitle-color); }
      .buttons .active { opacity: 1; }
    }
  }

  .image {
    grid-area: a;
    position: relative;

    .preview {
      height: 52px;
      width: 52px;
      border-radius: 50%;
      image-rendering: pixelated;
      object-fit: cover;
      display: block;
    }

    .preview--mono {
      display: flex;
      align-items: center;
      justify-content: center;
      background: color-mix(in srgb, var(--accent-color) 24%, black);
      color: var(--menu-text-color);
      font-weight: 700;
      font-size: 22px;
      image-rendering: auto;
    }

    .image-text {
      position: absolute;
      bottom: -2px;
      right: -2px;
      color: var(--menu-text-color);
      font-size: 11px;
      padding: 2px 8px;
      border-radius: var(--radius-pill);
    }
  }

  .title {
    grid-area: b;
    align-self: flex-end;
    display: flex;
    align-items: center;

    .title-text {
      font-size: 18px;
      color: var(--menu-text-color);
      font-weight: 600;
    }
  }

  .subtitle {
    grid-area: d;
    font-size: 14px;
    color: var(--menu-text-dimmed-color);
    align-self: flex-start;
    transition: color 0.2s ease;
  }

  .buttons {
    grid-area: c;
    display: flex;
    align-items: center;

    .active {
      display: flex;
      align-items: center;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
  }
</style>
