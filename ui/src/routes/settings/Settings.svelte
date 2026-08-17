<script lang="ts">
  import { onMount } from "svelte";
  import PageShell from "../../components/PageShell.svelte";
  import ModuleCard from "../../components/ModuleCard.svelte";
  import ScrollArea from "../../primitives/ScrollArea.svelte";
  import SettingRow from "../../components/SettingRow.svelte";
  import Tabs from "../../primitives/Tabs.svelte";
  import { api } from "../../integration/api";
  import type { Module, ModuleSetting } from "../../integration/types";
  import { uiScale, reduceMotion } from "../../stores/settings";

  let modules: Module[] = $state([]);
  let activeTab = $state("general");
  let scale = $state(1.0);
  let motionOff = $state(false);

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
  });

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
</style>
