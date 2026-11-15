"use client";

import { labelFromCode, marco, type MarcoId, type Medication } from "@/lib/model";

/** Pequeno padrão que imita o código da etiqueta. */
function FakeCode({ seed, color }: { seed: string; color: string }) {
  const cells: boolean[] = [];
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  for (let i = 0; i < 25; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    cells.push(((h >> 16) & 1) === 1 || i % 6 === 0);
  }
  return (
    <span className="fake-code" aria-hidden>
      {cells.map((on, i) => (
        <i key={i} style={{ background: on ? color : "transparent" }} />
      ))}
    </span>
  );
}

/** Etiqueta colorida de alto contraste: cor + ícone grande + código. */
export function LabelTag({
  code,
  marcoId,
  size = "md",
  showNumber = true,
}: {
  code?: string | null;
  marcoId?: MarcoId;
  size?: "sm" | "md" | "lg" | "xl";
  showNumber?: boolean;
}) {
  const id = code ? labelFromCode(code).marco : marcoId ?? "cafe";
  const mc = marco(id);
  const Icon = mc.icon;
  const n = code ? labelFromCode(code).n : null;
  return (
    <span
      className={`label-tag ${size}`}
      style={{ background: mc.color, color: mc.ink }}
      aria-label={`Etiqueta ${mc.colorName} com ${mc.iconName}${n ? ` número ${n}` : ""}`}
    >
      <Icon className="label-icon" strokeWidth={2.4} />
      {size !== "sm" && code ? <FakeCode seed={code} color={mc.ink} /> : null}
      {showNumber && n ? <b className="label-n">{n}</b> : null}
    </span>
  );
}

/** Caixa de remédio vista de lado, com ou sem etiqueta. */
export function MedBox({ med, onClick, disabled }: { med: Medication | { name: string; dosage: string; label: null; id: string }; onClick?: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="med-box" onClick={onClick} disabled={disabled}>
      <span className="med-box-print">
        <small>{med.name.split(" ")[0].toUpperCase()}</small>
        <small>{med.dosage}</small>
      </span>
      {med.label ? <LabelTag code={med.label} size="md" /> : <span className="no-label">sem etiqueta</span>}
    </button>
  );
}

export function Viewfinder({ children, state }: { children?: React.ReactNode; state: "idle" | "reading" | "ok" | "error" }) {
  return (
    <div className={`viewfinder ${state}`}>
      <span className="corner tl" />
      <span className="corner tr" />
      <span className="corner bl" />
      <span className="corner br" />
      {state === "reading" ? <span className="scanline" /> : null}
      <div className="viewfinder-content">{children}</div>
    </div>
  );
}
