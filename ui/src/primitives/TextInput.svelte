<script lang="ts">
  interface Props {
    label?: string;
    value?: string;
    placeholder?: string;
    hint?: string;
    error?: string;
    disabled?: boolean;
    type?: "text" | "password" | "search" | "url";
    class?: string;
    onchange?: (value: string) => void;
  }

  let {
    label = "",
    value = $bindable(""),
    placeholder = "",
    hint = "",
    error = "",
    disabled = false,
    type = "text",
    class: className = "",
    onchange,
  }: Props = $props();
</script>

<div class="text-input {className}" class:text-input--disabled={disabled}>
  {#if label}
    <label class="text-input__label" for={`input-${label}`}>{label}</label>
  {/if}
  <input
    id={label ? `input-${label}` : undefined}
    class="text-input__field"
    class:text-input__field--error={!!error}
    type={type}
    bind:value
    {placeholder}
    {disabled}
    aria-invalid={!!error}
    oninput={() => onchange?.(value)}
  />
  {#if error}
    <span class="text-input__message text-input__message--error">{error}</span>
  {:else if hint}
    <span class="text-input__message">{hint}</span>
  {/if}
</div>

<style lang="scss">
  .text-input {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .text-input__label {
    color: var(--text-secondary);
    font-size: var(--text-12);
    font-weight: 500;
  }

  .text-input__field {
    width: 100%;
    height: var(--control-height-md);
    padding: 0 var(--space-12);
    border-radius: var(--radius-control);
    border: 1px solid var(--border-subtle);
    background: var(--input-background);
    color: var(--text-primary);
    font-size: var(--text-13);
    transition:
      border-color var(--motion-fast) var(--ease-standard),
      background-color var(--motion-fast) var(--ease-standard);
  }

  .text-input__field::placeholder {
    color: var(--text-muted);
  }

  .text-input__field:hover:not(:disabled) {
    border-color: var(--border-strong);
  }

  .text-input__field:focus {
    border-color: var(--accent);
  }

  .text-input__field--error {
    border-color: var(--danger);
  }

  .text-input__field:disabled {
    opacity: 0.5;
  }

  .text-input__message {
    color: var(--text-muted);
    font-size: var(--text-11);
  }

  .text-input__message--error {
    color: var(--danger);
  }
</style>
