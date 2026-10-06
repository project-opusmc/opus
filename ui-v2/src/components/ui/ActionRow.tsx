import type { ReactNode } from "react";

type ActionRowProps = {
  label: string;
  detail: string;
  onClick: () => void;
  start?: ReactNode;
  end?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
};

export function ActionRow({ label, detail, onClick, start, end, danger = false, disabled = false, className = "" }: ActionRowProps) {
  const classes = [
    "ui-action-row",
    start ? "ui-action-row--with-start" : "",
    danger ? "ui-action-row--danger" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <button type="button" className={classes} onClick={onClick} disabled={disabled}>
      {start && <span className="ui-action-row__icon" aria-hidden="true">{start}</span>}
      <span className="ui-action-row__copy">
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      {end}
    </button>
  );
}
