import type { CSSProperties } from "react";

/**
 * daisyUI's `radial-progress` is driven by CSS custom properties (`--value`,
 * `--size`, `--thickness`) that the installed React `CSSProperties` type does
 * not model. One contained assertion here keeps every call site cast-free.
 */
export function radialStyle(
  value: number,
  size: string,
  thickness: string,
): CSSProperties {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- CSS custom properties aren't in the CSSProperties type
  return {
    "--value": value,
    "--size": size,
    "--thickness": thickness,
  } as CSSProperties;
}
