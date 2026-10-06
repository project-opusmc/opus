export function Mark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`opus-mark ${compact ? "opus-mark--compact" : ""}`} aria-label="Opus">
      <span className="opus-mark__index" aria-hidden="true">O</span>
      {!compact && <span className="opus-mark__word">OPUS</span>}
    </div>
  );
}
