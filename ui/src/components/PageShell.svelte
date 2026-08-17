<script lang="ts">
  import type { Snippet } from "svelte";
  import Badge from "../primitives/Badge.svelte";

  interface Props {
    title: string;
    description?: string;
    badge?: string;
    actions?: Snippet;
    children?: Snippet;
  }

  let {
    title,
    description = "",
    badge = "",
    actions,
    children,
  }: Props = $props();
</script>

<section class="page">
  <header class="page__header">
    <div class="page__heading">
      <h1 class="page__title text-page-title">{title}</h1>
      {#if description}
        <p class="page__description text-secondary">{description}</p>
      {/if}
    </div>
    <div class="page__meta">
      {#if badge}
        <Badge>{badge}</Badge>
      {/if}
      {#if actions}
        <div class="page__actions">
          {@render actions()}
        </div>
      {/if}
    </div>
  </header>
  <div class="page__body">
    {@render children?.()}
  </div>
</section>

<style lang="scss">
  .page {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    gap: var(--space-24);
    padding: var(--space-32) var(--space-32) var(--space-24);
  }

  .page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-24);
  }

  .page__heading {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
  }

  .page__title {
    margin: 0;
    color: var(--text-primary);
  }

  .page__description {
    margin: 0;
    color: var(--text-muted);
    max-width: 560px;
  }

  .page__meta {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    flex: none;
  }

  .page__actions {
    display: flex;
    align-items: center;
    gap: var(--space-8);
  }

  .page__body {
    flex: 1;
    min-height: 0;
  }
</style>
