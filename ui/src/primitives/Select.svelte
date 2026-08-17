<script lang="ts">
  interface Option {
    value: string;
    label: string;
    disabled?: boolean;
  }

  interface Props {
    label?: string;
    value?: string;
    options: Option[];
    disabled?: boolean;
    class?: string;
    onchange?: (value: string) => void;
  }

  let {
    label = "",
    value = $bindable(""),
    options,
    disabled = false,
    class: className = "",
    onchange,
  }: Props = $props();
</script>

<div class="select {className}" class:select--disabled={disabled}>
  {#if label}
    <label class="select__label" for={`select-${label}`}>{label}</label>
  {/if}
  <div class="select__wrap">
    <select
      id={label ? `select-${label}` : undefined}
      class="select__field"
      bind:value
      {disabled}
      onchange={() => onchange?.(value)}
    >
      {#each options as option (option.value)}
        <option
          value={option.value}
          disabled={option.disabled}
        >
          {option.label}
        </option>
      {/each}
    </select>
    <svg
      class="select__chevron"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  </div>
</div>

<style lang="scss">
  .select {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .select__label {
    color: var(--text-secondary);
    font-size: var(--text-12);
    font-weight: 500;
  }

  .select__wrap {
    position: relative;
  }

  .select__field {
    width: 100%;
    height: var(--control-height-md);
    padding: 0 var(--space-32) 0 var(--space-12);
    border-radius: var(--radius-control);
    border: 1px solid var(--border-subtle);
    background: var(--input-background);
    color: var(--text-primary);
    font-size: var(--text-13);
    appearance: none;
    transition: border-color var(--motion-fast) var(--ease-standard);
  }

  .select__field:hover:not(:disabled) {
    border-color: var(--border-strong);
  }

  .select__field:focus {
    border-color: var(--accent);
  }

  .select__chevron {
    position: absolute;
    top: 50%;
    right: var(--space-12);
    transform: translateY(-50%);
    color: var(--text-muted);
    pointer-events: none;
  }

  .select--disabled {
    opacity: 0.5;
  }
</style>
