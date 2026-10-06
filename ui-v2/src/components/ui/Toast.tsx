import type { ReactNode } from "react";

type ToastTone = "info" | "success" | "danger";

type ToastProps = {
  title: string;
  detail?: string;
  tone?: ToastTone;
  action?: ReactNode;
};

export function Toast({ title, detail, tone = "info", action }: ToastProps) {
  return (
    <div className={`ui-toast ui-toast--${tone}`} role={tone === "danger" ? "alert" : "status"}>
      <span className="ui-toast__copy">
        <strong>{title}</strong>
        {detail && <small>{detail}</small>}
      </span>
      {action}
    </div>
  );
}
