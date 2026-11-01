// Unit conversions at the data-layer boundary (DECISIONS D2/D3/D4/D8).
// DB stores integers; UI/services outside the DB speak rupees / plain units.
// Money: rupees <-> paisa (x100). Quantity: units <-> milli (x1000).
// Percent: % <-> x100 (10.5% <-> 1050). Rounding is half-up via Math.round,
// always applied on write so stored values stay exact integers.

export const toPaisa = (rupees: number): number => Math.round(rupees * 100);
export const fromPaisa = (paisa: number): number => paisa / 100;

export const toMilliQty = (qty: number): number => Math.round(qty * 1000);
export const fromMilliQty = (milli: number): number => milli / 1000;

export const toPercentX100 = (percent: number): number => Math.round(percent * 100);
export const fromPercentX100 = (x100: number): number => x100 / 100;
