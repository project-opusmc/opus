<script lang="ts">
  import MainButton from "../../menu/buttons/MainButton.svelte";
  import IconTextButton from "../../menu/buttons/IconTextButton.svelte";
  import ButtonContainer from "../../menu/buttons/ButtonContainer.svelte";
  import { close, navigate } from "../../stores/ui";
</script>

<section class="quick-hub" aria-label="Quick Hub">
  <header>
    <span class="eyebrow">OPUS</span>
    <h1>Quick Hub</h1>
    <p>Client tools without leaving the live game.</p>
  </header>

  <div class="actions">
    <MainButton
      title="Mods"
      subtitle="Open the module catalog"
      icon="modules"
      onclick={() => void navigate("mods_catalog")}
    />
    <MainButton
      title="HUD Editor"
      subtitle="Arrange the real in-game widgets"
      icon="hud"
      onclick={() => void navigate("hud_editor")}
    />
  </div>

  <ButtonContainer>
    <IconTextButton icon="close" title="Close" onclick={() => void close()} />
  </ButtonContainer>
</section>

<style lang="scss">
  .quick-hub {
    width: min(500px, calc(100vw - 48px));
    margin: auto;
    padding: 28px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    background: color-mix(in srgb, var(--menu-base-68-color) 88%, transparent);
    backdrop-filter: blur(18px);
    box-shadow: 0 22px 70px rgb(0 0 0 / 42%);
  }

  header { display: flex; flex-direction: column; gap: 5px; }
  .eyebrow { color: var(--accent-color); font-size: 11px; font-weight: 800; letter-spacing: 0.16em; }
  h1 { margin: 0; color: var(--menu-text-color); font-size: 28px; }
  p { margin: 0; color: var(--menu-text-dimmed-color); font-size: 14px; }
  .actions { display: flex; flex-direction: column; gap: 12px; }

  @media (max-height: 400px) {
    .quick-hub {
      width: calc(100vw - 24px);
      padding: 12px;
      gap: 10px;
    }

    h1 { font-size: 22px; }
    p { font-size: 11px; }
    .actions { gap: 6px; }
  }
</style>
