import { forwardRef } from "react";
import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "active";
type ButtonSize = "sm" | "md";

type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  variant = "secondary",
  size = "md",
  block = false,
  className = "",
  children,
  ...props
}, ref) {
  const classes = [
    "ui-button",
    `ui-button--${variant}`,
    size === "sm" ? "ui-button--sm" : "",
    block ? "ui-button--block" : "",
    className,
  ].filter(Boolean).join(" ");

  return <button ref={ref} type={props.type ?? "button"} className={classes} {...props}>{children}</button>;
});
