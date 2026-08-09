import type { LucideIcon, LucideProps } from "lucide-react";
import { forwardRef } from "react";

type Props = Omit<LucideProps, "ref"> & {
  icon: LucideIcon;
};

export const Icon = forwardRef<SVGSVGElement, Props>(function Icon(
  { icon: LucideIcon, size = 18, strokeWidth = 1.8, ...rest },
  ref,
) {
  return (
    <LucideIcon
      ref={ref}
      size={size}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    />
  );
});
