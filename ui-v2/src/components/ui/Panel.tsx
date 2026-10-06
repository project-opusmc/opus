import type { HTMLAttributes, PropsWithChildren } from "react";

type PanelProps = PropsWithChildren<HTMLAttributes<HTMLElement> & {
  as?: "section" | "div";
}>;

export function Panel({ as = "section", className = "", children, ...props }: PanelProps) {
  const Component = as;
  return <Component className={["ui-panel", className].filter(Boolean).join(" ")} {...props}>{children}</Component>;
}
