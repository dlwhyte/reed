export function TypingDots({ className }: { className?: string }) {
  return (
    <span className={className} aria-label="Thinking">
      <span className="bf-dot" />
      <span className="bf-dot" />
      <span className="bf-dot" />
    </span>
  );
}
