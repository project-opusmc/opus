import type { HTMLAttributes, PropsWithChildren } from "react";

type ScrollAreaProps = PropsWithChildren<HTMLAttributes<HTMLDivElement> & {
  label: string;
}>;

export function ScrollArea({ label, className = "", children, ...props }: ScrollAreaProps) {
  return (
    <div
      className={["ui-scroll-area", className].filter(Boolean).join(" ")}
      tabIndex={0}
      aria-label={label}
      {...props}
    >
      {children}
    </div>
  );
}
