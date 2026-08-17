<script lang="ts">
  interface Props {
    class?: string;
  }
  let { class: className = "" }: Props = $props();
</script>

<hr class="divider {className}" />

<style lang="scss">
  .divider {
    height: 1px;
    margin: 0;
    border: 0;
    background: var(--border-subtle);
  }
</style>
