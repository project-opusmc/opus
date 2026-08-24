<script lang="ts">
  interface Props {
    value?: boolean;
    title?: string;
    onchange?: (value: boolean) => void;
  }
  let { value = $bindable(false), title = "", onchange }: Props = $props();
</script>

<label class="switch-setting">
  <span class="switch">
    <input
      type="checkbox"
      bind:checked={value}
      onchange={() => onchange?.(value)}
    />
    <span class="slider"></span>
  </span>
  {#if title}
    <span class="title">{title}</span>
  {/if}
</label>

<style lang="scss">
  .switch-setting {
    display: flex;
    align-items: center;
    cursor: pointer;
    white-space: nowrap;
  }

  .title {
    color: var(--menu-text-color);
    font-size: 15px;
    margin-left: 8px;
    font-weight: 500;
  }

  .switch {
    position: relative;
    display: flex;
    width: 28px;
    height: 18px;
    align-items: center;

    input { display: none; }
  }

  .slider {
    position: absolute;
    top: 2px;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--menu-switch-track-color);
    transition: 0.3s ease;
    height: 14px;
    border-radius: var(--radius-pill);

    &::before {
      position: absolute;
      content: "";
      height: 20px;
      width: 20px;
      top: -3px;
      left: -6px;
      background-color: var(--menu-switch-thumb-color);
      transition: 0.3s ease;
      border-radius: 50%;
    }
  }

  input:checked + .slider { background-color: var(--menu-switch-track-active-color); }

  input:checked + .slider::before {
    transform: translateX(20px);
    background-color: var(--menu-switch-thumb-active-color);
  }
</style>
