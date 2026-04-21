type Props = {
  n: number;
  onClick?: () => void;
  color?: "olive" | "terracotta" | "plum";
};

const COLOR_MAP: Record<NonNullable<Props["color"]>, string> = {
  olive: "text-olive border-olive",
  terracotta: "text-terracotta border-terracotta",
  plum: "text-plum border-plum",
};

export function Cite({ n, onClick, color = "olive" }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-[4px] border font-mono font-semibold text-[10px] w-[18px] h-[18px] mx-[2px] align-[2px] bg-transparent leading-none ${COLOR_MAP[color]}`}
    >
      {n}
    </button>
  );
}
