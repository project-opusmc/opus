<script lang="ts">
  interface Props {
    checked?: boolean;
    label?: string;
    disabled?: boolean;
    class?: string;
    onchange?: (value: boolean) => void;
  }

  let {
    checked = $bindable(false),
    label = "",
    disabled = false,
    class: className = "",
    onchange,
  }: Props = $props();
</script>

<button
  type="button"
  role="switch"
  class="switch {className}"
  class:switch--checked={checked}
  class:switch--disabled={disabled}
  aria-checked={checked}
  aria-label={label || undefined}
  disabled={disabled}
  onclick={() => {
    checked = !checked;
    onchange?.(checked);
  }}
>
  <span class="switch__thumb"></span>
</button>

<style lang="scss">
  .switch {
    position: relative;
    width: 38px;
    height: 22px;
    flex: none;
    border-radius: var(--radius-pill);
    border: 1px solid var(--border-strong);
    background: var(--surface-3);
    transition:
      background-color var(--motion-fast) var(--ease-standard),
      border-color var(--motion-fast) var(--ease-standard);
  }

  .switch__thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: var(--radius-pill);
    background: var(--text-muted);
    transition:
      transform var(--motion-fast) var(--ease-standard),
      background-color var(--motion-fast) var(--ease-standard);
  }

  .switch--checked {
    background: var(--accent);
    border-color: var(--accent);
  }

  .switch--checked .switch__thumb {
    background: var(--surface-0);
    transform: translateX(16px);
  }

  .switch:hover:not(:disabled) {
    border-color: var(--text-secondary);
  }

  .switch--disabled {
    opacity: 0.45;
  }
</style>
