import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: ReactNode;
  active?: boolean;
};

export function IconButton({ label, icon, active = false, className = "", ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      className={["ui-icon-button", active ? "ui-icon-button--active" : "", className].filter(Boolean).join(" ")}
      aria-label={label}
      aria-pressed={active || undefined}
      {...props}
    >
      {icon}
    </button>
  );
}
