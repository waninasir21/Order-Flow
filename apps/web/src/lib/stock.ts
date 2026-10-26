// Same upper bound as the backend's updateProductStock; the backend is still the authority.
export const MAX_STOCK = 1_000_000;

// Parses what someone typed into the stock field. Returns an error message or the number.
export function parseStock(text: string): { value: number } | { error: string } {
  const trimmed = text.trim();
  if (trimmed === "") return { error: "Enter a number." };
  if (!/^\d+$/.test(trimmed)) return { error: "Whole numbers only, no negatives." };
  const value = Number(trimmed);
  if (value > MAX_STOCK) return { error: `Maximum is ${MAX_STOCK.toLocaleString("en-IN")}.` };
  return { value };
}
