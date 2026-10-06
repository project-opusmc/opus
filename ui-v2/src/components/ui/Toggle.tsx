type ToggleProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
};

export function Toggle({ value, onChange, label, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      className="ui-toggle"
      aria-pressed={value}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!value)}
    >
      {value ? "On" : "Off"}
    </button>
  );
}
