<script lang="ts">
  import Icon from "../Icon.svelte";

  interface Props {
    title: string;
    icon: string;
    parentHovered?: boolean;
    onclick?: () => void;
  }

  let { title, icon, parentHovered = false, onclick }: Props = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="child-button"
  class:parent-hovered={parentHovered}
  onclick={(event) => {
    event.stopPropagation();
    onclick?.();
  }}
>
  <span class="icon">
    <Icon name={icon} size={20} />
  </span>
  <span class="title">{title}</span>
</div>

<style lang="scss">
  .child-button {
    position: relative;
    display: flex;
    align-items: center;
    border-radius: var(--radius-control);
    background-color: var(--menu-child-button-background-color, var(--accent-color));
    transition: background-color 0.2s ease;
    padding: 12px 14px;
    cursor: pointer;

    &.parent-hovered {
      background-color: var(--menu-main-button-icon-hover-background-color);

      .icon { color: var(--menu-title-button-icon-hover-color); }
      .title { color: var(--accent-color); }
    }
  }

  .icon {
    color: var(--menu-title-button-icon-color);
    display: flex;
    transition: color 0.2s ease;
  }

  .title {
    color: var(--menu-text-color);
    font-weight: 600;
    font-size: 15px;
    transition: color 0.2s ease;
    margin-left: 8px;
    white-space: nowrap;
  }
</style>
