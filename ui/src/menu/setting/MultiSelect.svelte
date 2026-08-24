<script lang="ts">
  import Icon from "../Icon.svelte";

  interface Props {
    title: string;
    options: string[];
    values: string[];
    onchange?: (values: string[]) => void;
  }

  let { title, options, values = $bindable([]), onchange }: Props = $props();

  let expanded = $state(false);
  let root: HTMLElement;

  function toggle(option: string) {
    values = values.includes(option)
      ? values.filter((v) => v !== option)
      : [...values, option];
    onchange?.(values);
  }

  function onWindowClick(event: MouseEvent) {
    if (root && !root.contains(event.target as Node)) {
      expanded = false;
    }
  }
</script>

<svelte:window onclick={onWindowClick} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="select" class:expanded bind:this={root}>
  <div class="header" onclick={() => (expanded = !expanded)}>
    <span class="label">{title}</span>
    <span class="chevron" class:open={expanded}><Icon name="chevron" size={16} /></span>
  </div>
  {#if expanded}
    <div class="options">
      {#each options as option (option)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          class="option"
          class:active={values.includes(option)}
          onclick={() => toggle(option)}
        >
          {option}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style lang="scss">
  .select {
    cursor: pointer;
    min-width: 190px;
    position: relative;

    &.expanded .header { border-radius: var(--radius-control) var(--radius-control) 0 0; }
  }

  .header {
    background-color: var(--menu-select-header-background-color);
    padding: 14px 18px;
    display: flex;
    column-gap: 16px;
    align-items: center;
    justify-content: space-between;
    border-radius: var(--radius-control);
    color: var(--menu-text-color);
    font-size: 15px;
    font-weight: 500;
  }

  .chevron {
    display: flex;
    transition: transform 0.2s ease;
    &.open { transform: rotate(180deg); }
  }

  .options {
    position: absolute;
    z-index: 1000;
    width: 100%;
    border-radius: 0 0 var(--radius-control) var(--radius-control);
    max-height: 250px;
    overflow: auto;
    background-color: var(--menu-select-options-background-color);
  }

  .option {
    font-weight: 500;
    color: var(--menu-text-dimmed-color);
    font-size: 15px;
    padding: 12px 18px;
    transition: color 0.2s ease;

    &:hover { color: var(--menu-text-color); }
    &.active { color: var(--accent-color); }
  }
</style>
