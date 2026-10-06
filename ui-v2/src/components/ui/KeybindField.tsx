import { useEffect, useRef, useState } from "react";

type KeybindFieldProps = {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
};

function displayKey(key: string | null) {
  if (!key) return "Unbound";
  if (key === " ") return "Space";
  return key.length === 1 ? key.toUpperCase() : key;
}

export function KeybindField({ label, value, onChange }: KeybindFieldProps) {
  const [listening, setListening] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!listening) return;
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        setListening(false);
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        onChange(null);
        setListening(false);
        return;
      }
      onChange(event.key);
      setListening(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [listening, onChange]);

  return (
    <div className="ui-keybind-field">
      <span>{label}</span>
      <button
        ref={buttonRef}
        type="button"
        className={listening ? "ui-keybind-field__button ui-keybind-field__button--listening" : "ui-keybind-field__button"}
        aria-label={`${label}: ${listening ? "waiting for key" : displayKey(value)}`}
        onClick={() => setListening(true)}
      >
        {listening ? "Press a key…" : displayKey(value)}
      </button>
    </div>
  );
}
