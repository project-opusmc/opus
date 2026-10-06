import { useState } from "react";
import {
  ActionRow,
  Button,
  IconButton,
  KeybindField,
  Modal,
  Panel,
  ScrollArea,
  SearchField,
  SelectField,
  Slider,
  Tabs,
  Toast,
  Toggle,
  Tooltip,
} from "../components/ui";

type DemoTab = "general" | "hud" | "input";

export function DesignLab() {
  const [toggle, setToggle] = useState(true);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(false);
  const [slider, setSlider] = useState(70);
  const [select, setSelect] = useState("balanced");
  const [tab, setTab] = useState<DemoTab>("general");
  const [keybind, setKeybind] = useState<string | null>("r");

  return (
    <main className="ui-lab" data-opus-design-lab>
      <div className="ui-lab__frame">
        <header className="ui-lab__header">
          <h1>Opus UI Lab</h1>
          <p>Canonical web development surface for shared tokens, states and interaction primitives.</p>
        </header>

        <div className="ui-lab__routes" aria-label="Product route previews">
          <span>Preview routes</span>
          <a href="/#/title">Home</a>
          <a href="/#/singleplayer">Singleplayer</a>
          <a href="/#/multiplayer">Multiplayer</a>
          <a href="/#/settings?settingsSection=interface">Client Settings</a>
          <a href="/#/accounts">Accounts</a>
          <a href="/#/mods_catalog">Modules</a>
          <a href="/#/quick_hub">Public Client</a>
          <a href="/#/game_menu">Pause</a>
          <a href="/#/hud_editor">HUD Editor</a>
        </div>

        <div className="ui-lab__grid">
          <Panel className="ui-lab__section">
            <h2>Buttons</h2>
            <div className="ui-lab__row">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="active">Active</Button>
              <Button variant="danger">Danger</Button>
              <Button disabled>Disabled</Button>
              <Tooltip content="Icon-only controls always carry an accessible label.">
                <IconButton label="Close demo" icon={<span aria-hidden="true">×</span>} />
              </Tooltip>
            </div>
          </Panel>

          <Panel className="ui-lab__section">
            <h2>Inputs</h2>
            <SearchField label="Search modules" value={query} onChange={setQuery} placeholder="Filter modules" />
            <SelectField
              label="Profile"
              value={select}
              onChange={setSelect}
              options={[
                { value: "balanced", label: "Balanced" },
                { value: "competitive", label: "Competitive" },
                { value: "minimal", label: "Minimal" },
              ]}
            />
            <Slider label="HUD opacity" value={slider} min={20} max={100} onChange={setSlider} formatValue={(value) => `${value}%`} />
            <Toggle value={toggle} onChange={setToggle} label="Demo toggle" />
            <KeybindField label="Open client" value={keybind} onChange={setKeybind} />
          </Panel>

          <Panel className="ui-lab__section">
            <h2>Navigation</h2>
            <Tabs<DemoTab>
              label="Settings sections"
              value={tab}
              onChange={setTab}
              tabs={[
                { id: "general", label: "General" },
                { id: "hud", label: "HUD" },
                { id: "input", label: "Input" },
              ]}
            />
            <ActionRow label="Modules" detail="Browse and configure client modules." onClick={() => undefined} end={<span>›</span>} />
            <ActionRow label="Disconnect" detail="Leave the current world." onClick={() => undefined} danger end={<span>›</span>} />
          </Panel>

          <Panel className="ui-lab__section">
            <h2>Feedback</h2>
            <Toast title="Profile saved" detail="The local UI state was updated." tone="success" />
            <Toast
              title="Host unavailable"
              detail="A Minecraft-owned action cannot run in the browser fixture."
              tone="danger"
              action={<Button variant="ghost" size="sm">Dismiss</Button>}
            />
            <Button variant="secondary" onClick={() => setModal(true)}>Open modal</Button>
          </Panel>

          <Panel className="ui-lab__section">
            <h2>Scroll area</h2>
            <ScrollArea label="Demo scroll area" className="ui-lab__scroll">
              {Array.from({ length: 12 }, (_, index) => (
                <div className="ui-lab__scroll-row" key={index}>Row {String(index + 1).padStart(2, "0")}</div>
              ))}
            </ScrollArea>
          </Panel>
        </div>
      </div>

      {modal && (
        <Modal
          eyebrow="Component state"
          title="Shared modal"
          detail="This is the same modal primitive used by browser-only Minecraft host boundaries."
          footer={<Button variant="primary" block onClick={() => setModal(false)} autoFocus>Close</Button>}
        />
      )}
    </main>
  );
}
