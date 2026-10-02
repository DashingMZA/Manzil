import type { ReactNode } from "react";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="card">
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}

export function Alert({ kind = "error", children }: { kind?: "error" | "warn"; children: ReactNode }) {
  return <div className={`alert ${kind}`}>{children}</div>;
}
