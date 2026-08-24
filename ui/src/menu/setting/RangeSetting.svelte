<script lang="ts">
  interface Props {
    title?: string;
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    onchange?: (value: number) => void;
  }

  let {
    title = "",
    value = $bindable(0),
    min = 0,
    max = 100,
    step = 1,
    unit = "",
    onchange,
  }: Props = $props();

  let percent = $derived(max <= min ? 0 : ((value - min) / (max - min)) * 100);
</script>

<div class="range-setting">
  {#if title}
    <div class="range-setting__head">
      <span class="range-setting__title">{title}</span>
      <span class="range-setting__value">{value}{unit}</span>
    </div>
  {/if}
  <input
    class="range-setting__input"
    type="range"
    bind:value
    {min}
    {max}
    {step}
    style:--range-progress={`${percent}%`}
    oninput={(event) =>
      onchange?.(Number((event.currentTarget as HTMLInputElement).value))}
  />
</div>

<style lang="scss">
  .range-setting {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 200px;
  }

  .range-setting__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }

  .range-setting__title {
    color: var(--menu-text-color);
    font-size: 15px;
    font-weight: 500;
  }

  .range-setting__value {
    color: var(--menu-text-dimmed-color);
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }

  .range-setting__input {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 18px;
    margin: 0;
    background: transparent;
    cursor: pointer;
  }

  .range-setting__input::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: var(--radius-pill);
    background: linear-gradient(
      to right,
      var(--accent-color) 0%,
      var(--accent-color) var(--range-progress),
      color-mix(in srgb, var(--menu-text-color) 20%, black) var(--range-progress),
      color-mix(in srgb, var(--menu-text-color) 20%, black) 100%
    );
  }

  .range-setting__input::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    margin-top: -5px;
    border-radius: 50%;
    background: var(--accent-color);
    border: 3px solid var(--surface-color);
  }
</style>
