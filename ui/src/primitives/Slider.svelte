<script lang="ts">
  interface Props {
    label?: string;
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    disabled?: boolean;
    class?: string;
    onchange?: (value: number) => void;
  }

  let {
    label = "",
    value = $bindable(0),
    min = 0,
    max = 100,
    step = 1,
    unit = "",
    disabled = false,
    class: className = "",
    onchange,
  }: Props = $props();

  let percent = $derived(
    max <= min ? 0 : Math.round(((value - min) / (max - min)) * 100),
  );
</script>

<div class="slider {className}" class:slider--disabled={disabled}>
  {#if label}
    <div class="slider__header">
      <span class="slider__label">{label}</span>
      <span class="slider__value">
        {value}{unit}
      </span>
    </div>
  {/if}
  <input
    class="slider__input"
    type="range"
    bind:value
    {min}
    {max}
    {step}
    {disabled}
    style:--slider-progress={`${percent}%`}
    oninput={(event) =>
      onchange?.(Number((event.currentTarget as HTMLInputElement).value))}
  />
</div>

<style lang="scss">
  .slider {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .slider__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-12);
  }

  .slider__label {
    color: var(--text-secondary);
    font-size: var(--text-12);
    font-weight: 500;
  }

  .slider__value {
    color: var(--text-primary);
    font-size: var(--text-12);
    font-variant-numeric: tabular-nums;
  }

  .slider__input {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 20px;
    margin: 0;
    background: transparent;
    cursor: pointer;
  }

  .slider__input::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: var(--radius-pill);
    background: linear-gradient(
      to right,
      var(--accent) 0%,
      var(--accent) var(--slider-progress),
      var(--surface-3) var(--slider-progress),
      var(--surface-3) 100%
    );
  }

  .slider__input::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    margin-top: -5px;
    border-radius: var(--radius-pill);
    background: var(--accent);
    border: 3px solid var(--surface-0);
    box-shadow: 0 0 0 1px var(--border-strong);
    transition: transform var(--motion-fast) var(--ease-standard);
  }

  .slider__input:hover::-webkit-slider-thumb {
    transform: scale(1.08);
  }

  .slider--disabled {
    opacity: 0.45;
  }
</style>
