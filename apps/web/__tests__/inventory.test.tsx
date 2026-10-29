import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InventoryTable, type ProductRowData } from "@/app/(dashboard)/inventory/inventory-table";
import { updateProductStockAction } from "@/app/(dashboard)/inventory/actions";
import { MAX_STOCK, parseStock } from "@/lib/stock";

jest.mock("@/app/(dashboard)/inventory/actions", () => ({ updateProductStockAction: jest.fn() }));
const action = updateProductStockAction as jest.Mock;

const PRODUCTS: ProductRowData[] = [
  { id: "p1", name: "Biscuits", sku: "BIS-001", price: 10, stock: 120 },
  { id: "p2", name: "Soap", sku: "SOP-002", price: 45.5, stock: 4 },
  { id: "p3", name: "Tea", sku: "TEA-003", price: 210, stock: 0 },
];

beforeEach(() => {
  jest.clearAllMocks();
  action.mockResolvedValue({ ok: true });
});

async function startEditing(user: ReturnType<typeof userEvent.setup>, name: string, stock: number) {
  await user.click(screen.getByRole("button", { name: `Edit stock for ${name}, currently ${stock}` }));
  return screen.getByRole("textbox", { name: new RegExp(`New stock for ${name}`) });
}

describe("parseStock", () => {
  it.each([
    ["0", 0],
    ["42", 42],
    ["  7  ", 7],
    [String(MAX_STOCK), MAX_STOCK],
  ])("accepts %j", (text, value) => expect(parseStock(text)).toEqual({ value }));

  it.each(["", "   ", "-1", "1.5", "abc", "1e3", "12 3", "+5"])("rejects %j", (text) =>
    expect(parseStock(text)).toHaveProperty("error")
  );

  it("rejects values above the maximum", () => {
    expect(parseStock(String(MAX_STOCK + 1))).toEqual({ error: "Maximum is 10,00,000." });
  });
});

describe("inventory table", () => {
  it("lists products and flags low and out-of-stock levels", () => {
    render(<InventoryTable products={PRODUCTS} />);
    expect(screen.getAllByRole("row")).toHaveLength(4);
    expect(screen.getByText("Out of stock", { selector: "span.rounded-full" })).toBeInTheDocument();
    expect(screen.getByText("Low stock")).toBeInTheDocument(); // Soap: 4 < 10
    expect(screen.getByText("OK")).toBeInTheDocument(); // Biscuits
  });

  it("'Low stock only' hides healthy products", async () => {
    const user = userEvent.setup();
    render(<InventoryTable products={PRODUCTS} />);
    await user.click(screen.getByRole("checkbox", { name: "Low stock only" }));
    expect(screen.queryByText("Biscuits")).toBeNull();
    expect(screen.getByText("Soap")).toBeInTheDocument();
    expect(screen.getByText("Tea")).toBeInTheDocument();
  });

  it("searches by name or SKU", async () => {
    const user = userEvent.setup();
    render(<InventoryTable products={PRODUCTS} />);
    await user.type(screen.getByRole("searchbox", { name: "Search products" }), "sop-");
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });
});

describe("stock edit validation", () => {
  it.each([
    ["-5", /Whole numbers only/],
    ["12.5", /Whole numbers only/],
    ["abc", /Whole numbers only/],
    ["", /Enter a number/],
    ["1000001", /Maximum is/],
  ])("rejects %j without calling the server", async (typed, message) => {
    const user = userEvent.setup();
    render(<InventoryTable products={PRODUCTS} />);
    const input = await startEditing(user, "Biscuits", 120);
    await user.clear(input);
    if (typed) await user.type(input, typed);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(action).not.toHaveBeenCalled();
  });

  it("clears the error as soon as the person edits the field again", async () => {
    const user = userEvent.setup();
    render(<InventoryTable products={PRODUCTS} />);
    const input = await startEditing(user, "Biscuits", 120);
    await user.clear(input);
    await user.type(input, "-1");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await user.type(input, "0");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a valid number calls the mutation with the product id and the number", async () => {
    const user = userEvent.setup();
    render(<InventoryTable products={PRODUCTS} />);
    const input = await startEditing(user, "Soap", 4);
    await user.clear(input);
    await user.type(input, "250{Enter}"); // Enter submits like the Save button
    expect(action).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith("p2", 250);
  });

  it("saving an unchanged value just closes the editor", async () => {
    const user = userEvent.setup();
    render(<InventoryTable products={PRODUCTS} />);
    await startEditing(user, "Soap", 4);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(action).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: /New stock/ })).toBeNull();
  });

  it("Escape and Cancel discard the edit", async () => {
    const user = userEvent.setup();
    render(<InventoryTable products={PRODUCTS} />);
    let input = await startEditing(user, "Soap", 4);
    await user.type(input, "9{Escape}");
    expect(screen.queryByRole("textbox", { name: /New stock/ })).toBeNull();

    input = await startEditing(user, "Soap", 4);
    await user.type(input, "9");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(action).not.toHaveBeenCalled();
  });

  it("shows the server's rejection and keeps the old number", async () => {
    const user = userEvent.setup();
    action.mockResolvedValue({ ok: false, message: "Your account isn't allowed to do that." });
    render(<InventoryTable products={PRODUCTS} />);
    const input = await startEditing(user, "Biscuits", 120);
    await user.clear(input);
    await user.type(input, "5{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("isn't allowed");
    expect(await screen.findByRole("button", { name: "Edit stock for Biscuits, currently 120" })).toBeInTheDocument();
  });
});
