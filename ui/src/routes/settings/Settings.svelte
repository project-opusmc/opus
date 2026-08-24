<script lang="ts">
  import { onMount } from "svelte";
  import OptionBar from "../../menu/optionbar/OptionBar.svelte";
  import RouteState from "../../menu/RouteState.svelte";
  import Divider from "../../menu/optionbar/Divider.svelte";
  import MenuList from "../../menu/list/MenuList.svelte";
  import BottomButtonWrapper from "../../menu/buttons/BottomButtonWrapper.svelte";
  import ButtonContainer from "../../menu/buttons/ButtonContainer.svelte";
  import IconTextButton from "../../menu/buttons/IconTextButton.svelte";
  import ButtonSetting from "../../menu/setting/ButtonSetting.svelte";
  import SwitchSetting from "../../menu/setting/SwitchSetting.svelte";
  import RangeSetting from "../../menu/setting/RangeSetting.svelte";
  import { bridge } from "../../integration/api";
  import { isStandalone } from "../../integration/host";
  import { back, navigation } from "../../stores/ui";
  import { uiScale, reduceMotion, settingsTab } from "../../stores/settings";
  import type { GameOption } from "../../integration/types";

  type Tab = "interface" | "game";

  let activeTab = $state<Tab>("interface");
  let gameOptions: GameOption[] = $state([]);
  let scale = $state(1.0);
  let motionOff = $state(false);
  let loading = $state(false);
  let error = $state("");
  let actionError = $state("");

  const tabs: { id: Tab; label: string }[] = isStandalone
    ? [
        { id: "interface", label: "Interface" },
        { id: "game", label: "Game" },
      ]
    : [{ id: "game", label: "Game" }];

  async function loadGameOptions() {
    if (isStandalone) return;
    loading = true;
    error = "";
    actionError = "";
    try {
      gameOptions = await bridge.getGameOptions();
    } catch (failure) {
      error = failure instanceof Error ? failure.message : "Could not load game options";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    activeTab = isStandalone
      ? $settingsTab
      : ($navigation.current.params?.settingsSection ?? "game");
    scale = isStandalone ? $uiScale : 1.0;
    motionOff = isStandalone ? $reduceMotion : false;
    void loadGameOptions();
  });

  function applyScale(value: number) {
    if (!isStandalone) return;
    scale = value;
    // Auto-fit scaling (installUiScale) subscribes to uiScale and re-applies the
    // combined zoom (window fit × user scale); don't set zoom directly here or
    // it would clobber the fit factor.
    uiScale.set(value);
  }

  function applyMotion(value: boolean) {
    motionOff = value;
    reduceMotion.set(value);
    document.documentElement.dataset.reduceMotion = value ? "true" : "false";
  }

  async function changeGameOption(option: GameOption, value: number) {
    if (isStandalone) return;
    actionError = "";
    try {
      if (option.type === "boolean") await bridge.adjustGameOption(option.key, 1);
      else if (option.type === "float") await bridge.setGameOption(option.key, value);
      else await bridge.adjustGameOption(option.key, 1);
      gameOptions = await bridge.getGameOptions();
    } catch (failure) {
      actionError = failure instanceof Error ? failure.message : "Could not update game option";
    }
  }
</script>

<OptionBar>
  {#each tabs as tab (tab.id)}
    <ButtonSetting
      title={tab.label}
      secondary={activeTab !== tab.id}
      onclick={() => {
        activeTab = tab.id;
        settingsTab.set(tab.id);
      }}
    />
    {#if tab.id === "interface"}<Divider />{/if}
  {/each}
</OptionBar>

<MenuList>
  {#if activeTab === "interface"}
    <div class="panel">
      {#if isStandalone}
        <div class="row">
          <div class="row__label">
            <span class="row__title">UI scale</span>
            <span class="row__note">Standalone preview size</span>
          </div>
          <div class="row__control">
            <RangeSetting value={scale} min={0.75} max={1.5} step={0.05} onchange={applyScale} />
          </div>
        </div>
      {/if}
      <div class="row">
        <div class="row__label">
          <span class="row__title">Reduce motion</span>
          <span class="row__note">Minimize animations</span>
        </div>
        <SwitchSetting value={motionOff} onchange={applyMotion} />
      </div>
    </div>
  {:else if activeTab === "game"}
    <RouteState
      loading={loading}
      error={error || actionError}
      retry={() => void loadGameOptions()}
      empty={gameOptions.length === 0 ? "No game options are available from the bridge." : ""}
    />
    {#if !loading && !error && !actionError && gameOptions.length > 0}
      <div class="panel">
        {#each gameOptions as option (option.key)}
          <div class="row">
            <div class="row__label">
              <span class="row__title">{option.label}</span>
            </div>
            <div class="row__control">
              {#if option.type === "boolean"}
                <SwitchSetting
                  value={option.value === 1}
                  onchange={() => changeGameOption(option, 1)}
                />
              {:else if option.type === "float"}
                <RangeSetting
                  value={option.value}
                  min={option.min}
                  max={option.max}
                  step={option.step}
                  onchange={(value) => changeGameOption(option, value)}
                />
              {:else}
                <ButtonSetting title={String(option.value)} onclick={() => changeGameOption(option, option.value + 1)} />
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</MenuList>

<BottomButtonWrapper>
  <ButtonContainer>
    <IconTextButton icon="back" title="Back" onclick={() => void back()} />
  </ButtonContainer>
</BottomButtonWrapper>

<style lang="scss">
  .panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 640px;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 16px 4px;

    & + .row { border-top: solid 1px var(--menu-base-36-color); }
  }

  .row__label {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .row__title { color: var(--menu-text-color); font-size: 16px; font-weight: 500; }
  .row__note { color: var(--menu-text-dimmed-color); font-size: 13px; }
  .row__control { flex: none; width: 240px; display: flex; justify-content: flex-end; }

</style>
