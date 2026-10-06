import type { PropsWithChildren, ReactNode } from "react";

type ModalProps = PropsWithChildren<{
  eyebrow?: string;
  title: string;
  detail?: string;
  footer?: ReactNode;
  titleId?: string;
}>;

export function Modal({
  eyebrow,
  title,
  detail,
  footer,
  titleId = "opus-modal-title",
  children,
}: ModalProps) {
  return (
    <div className="ui-modal-layer" role="presentation">
      <section className="ui-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        {eyebrow && <span className="ui-modal__eyebrow">{eyebrow}</span>}
        <h2 id={titleId}>{title}</h2>
        {detail && <p>{detail}</p>}
        {children}
        {footer}
      </section>
    </div>
  );
}
