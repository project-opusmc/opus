<script lang="ts">
  import OpusLogo from "../OpusLogo.svelte";
  import Account from "./Account.svelte";
  import { navigation } from "../../stores/ui";
</script>

<div class="header">
  <OpusLogo />
  {#if $navigation.worldContext === "none"}
    <Account />
  {/if}
</div>

<style lang="scss">
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 44px;
    flex: none;
  }

  @media (max-height: 600px) {
    .header { margin-bottom: 14px; }
  }
</style>
