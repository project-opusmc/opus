export function Mark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`opus-mark ${compact ? "opus-mark--compact" : ""}`} aria-label="Opus">
      <span className="opus-mark__glyph" aria-hidden="true">
        <span className="opus-mark__orbit" />
        <span className="opus-mark__core" />
      </span>
      {!compact && <span className="opus-mark__word">OPUS</span>}
    </div>
  );
}
