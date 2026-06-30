export function AuroraBackground() {
  return (
    <div
      aria-hidden="true"
      className="clay-aurora pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="aurora-layer aurora-layer-one" />
      <div className="aurora-layer aurora-layer-two" />
      <div className="aurora-layer aurora-layer-three" />
    </div>
  );
}
