<script lang="ts">
  interface Props { text: string; }
  let { text }: Props = $props();
</script>

<span class="tag">{text}</span>

<style lang="scss">
  .tag {
    background-color: var(--menu-list-tag-background-color);
    color: var(--menu-text-color);
    font-size: 11px;
    padding: 3px 10px;
    border-radius: var(--radius-pill);
    margin-left: 8px;
    white-space: nowrap;
  }
</style>
