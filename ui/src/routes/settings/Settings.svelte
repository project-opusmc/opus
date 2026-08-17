<script lang="ts">
  import { onMount } from "svelte";
  import PageShell from "../../components/PageShell.svelte";
  import ModuleCard from "../../components/ModuleCard.svelte";
  import Button from "../../primitives/Button.svelte";
  import ScrollArea from "../../primitives/ScrollArea.svelte";
  import SettingRow from "../../components/SettingRow.svelte";
  import Slider from "../../primitives/Slider.svelte";
  import Switch from "../../primitives/Switch.svelte";
  import Tabs from "../../primitives/Tabs.svelte";
  import { api, bridge } from "../../integration/api";
  import { isStandalone } from "../../integration/host";
  import type {
    GameOption,
    Module,
    ModuleSetting,
  } from "../../integration/types";
  import { uiScale, reduceMotion } from "../../stores/settings";

  let modules: Module[] = $state([]);
  let activeTab = $state("general");
  let scale = $state(1.0);
  let motionOff = $state(false);
  let gameOptions: GameOption[] = $state([]);

  const generalSettings: ModuleSetting[] = [
    {
      key: "ui-scale",
      label: "UI scale",
      type: "float",
      value: 1,
      min: 0.5,
      max: 2,
      step: 0.05,
    },
    {
      key: "reduce-motion",
      label: "Reduce motion",
      type: "boolean",
      value: false,
    },
    {
      key: "language",
      label: "Language",
      type: "enum",
      value: "en_us",
      options: [
        { value: "en_us", label: "English (US)" },
        { value: "vi_vn", label: "Tiếng Việt" },
        { value: "ja_jp", label: "日本語" },
      ],
    },
    {
      key: "theme",
      label: "Theme",
      type: "enum",
      value: "opus-dark",
      options: [
        { value: "opus-dark", label: "Opus Dark" },
        { value: "system", label: "System" },
      ],
    },
  ];

  onMount(async () => {
    modules = await api.getModules();
    if (!isStandalone) {
      gameOptions = await bridge.getGameOptions();
    }
  });

  async function changeGameOption(option: GameOption, value: number) {
    if (isStandalone) {
      return;
    }
    if (option.type === "boolean") {
      await bridge.adjustGameOption(option.key, 1);
    } else if (option.type === "float") {
      await bridge.setGameOption(option.key, value);
    }
    gameOptions = await bridge.getGameOptions();
  }

  async function stepEnum(option: GameOption, delta: number) {
    if (isStandalone) {
      return;
    }
    await bridge.adjustGameOption(option.key, delta);
    gameOptions = await bridge.getGameOptions();
  }

  function toggleModule(id: string, enabled: boolean) {
    modules = modules.map((module) =>
      module.id === id ? { ...module, enabled } : module,
    );
    void api.setModuleEnabled(id, enabled);
  }

  function changeModuleSetting(
    moduleId: string,
    key: string,
    value: boolean | number | string,
  ) {
    modules = modules.map((module) =>
      module.id === moduleId
        ? {
            ...module,
            settings: module.settings.map((setting) =>
              setting.key === key ? { ...setting, value } : setting,
            ),
          }
        : module,
    );
    void api.setModuleSetting(moduleId, key, value);
  }
</script>

<PageShell
  title="Client Settings"
  description="Configure the Opus client surface and modules."
  badge="SETTINGS"
>
  <Tabs
    items={[
      { id: "general", label: "General" },
      { id: "game", label: "Game" },
      { id: "modules", label: "Modules" },
    ]}
    bind:active={activeTab}
  >
    {#snippet children({ active })}
      {#if active === "general"}
        <ScrollArea>
          <div class="settings-section">
            {#each generalSettings as setting (setting.key)}
              <SettingRow
                {setting}
                onchange={(key, value) => {
                  if (key === "ui-scale" && typeof value === "number") {
                    scale = value;
                    uiScale.set(value);
                  }
                  if (key === "reduce-motion" && typeof value === "boolean") {
                    motionOff = value;
                    reduceMotion.set(value);
                  }
                  if (key === "theme") {
                    document.documentElement.dataset.theme = String(value);
                  }
                  console.info("[opus-ui] setting", key, value);
                }}
              />
            {/each}
          </div>
        </ScrollArea>
      {:else if active === "modules"}
        <ScrollArea>
          <div class="module-grid">
            {#each modules as module (module.id)}
              <ModuleCard
                {module}
                ontoggle={toggleModule}
                onsetting={changeModuleSetting}
              />
            {/each}
          </div>
        </ScrollArea>
      {:else if active === "game"}
        <ScrollArea>
          <div class="settings-section">
            {#if gameOptions.length === 0}
              <div class="state text-secondary">
                No live game. Open this UI from the running Opus client to edit
                the actual game options.
              </div>
            {:else}
              {#each gameOptions as option (option.key)}
                <div class="game-option">
                  <span class="text-regular">{option.label}</span>
                  {#if option.type === "boolean"}
                    <Switch
                      checked={option.value === 1}
                      label={option.label}
                      onchange={() => changeGameOption(option, 1)}
                    />
                  {:else if option.type === "float"}
                    <Slider
                      value={option.value}
                      min={option.min}
                      max={option.max}
                      step={option.step}
                      onchange={(value) => changeGameOption(option, value)}
                    />
                  {:else}
                    <div class="enum-row">
                      <Button size="sm" onclick={() => stepEnum(option, -1)}>
                        −
                      </Button>
                      <span class="text-control">{option.value}</span>
                      <Button size="sm" onclick={() => stepEnum(option, 1)}>
                        +
                      </Button>
                    </div>
                  {/if}
                </div>
              {/each}
            {/if}
          </div>
        </ScrollArea>
      {/if}
    {/snippet}
  </Tabs>
</PageShell>

<style lang="scss">
  .settings-section {
    max-width: 720px;
  }

  .module-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--space-16);
  }

  .game-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-24);
    padding: var(--space-12) 0;
    max-width: 720px;
  }

  .game-option + .game-option {
    border-top: 1px solid var(--border-subtle);
  }

  .enum-row {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    min-width: 140px;
    justify-content: flex-end;
  }

  .state {
    color: var(--text-muted);
  }
</style>
