type TabOption<T extends string> = {
  id: T;
  label: string;
};

type TabsProps<T extends string> = {
  label: string;
  value: T;
  tabs: TabOption<T>[];
  onChange: (value: T) => void;
};

export function Tabs<T extends string>({ label, value, tabs, onChange }: TabsProps<T>) {
  return (
    <div className="ui-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === value}
          className={tab.id === value ? "ui-tabs__tab ui-tabs__tab--active" : "ui-tabs__tab"}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
