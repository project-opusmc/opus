import type { ChangeEventHandler, ReactNode } from "react";

type SearchFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: ReactNode;
};

export function SearchField({ label, value, onChange, placeholder = "Search", icon }: SearchFieldProps) {
  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => onChange(event.target.value);

  return (
    <label className="ui-search-field">
      <span className="ui-search-field__label">{label}</span>
      <span className="ui-search-field__control">
        {icon && <span className="ui-search-field__icon" aria-hidden="true">{icon}</span>}
        <input
          className="ui-search-field__input"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          type="search"
        />
      </span>
    </label>
  );
}
