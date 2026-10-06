import type { PropsWithChildren } from "react";

type TooltipProps = PropsWithChildren<{
  content: string;
}>;

export function Tooltip({ content, children }: TooltipProps) {
  return <span className="ui-tooltip" data-tooltip={content}>{children}</span>;
}
