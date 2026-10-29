import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrdersTable, type OrderRowData } from "@/app/(dashboard)/orders/orders-table";
import { updateOrderStatusAction } from "@/app/(dashboard)/orders/actions";

const push = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));
// The Server Action is the boundary: the table's job is to call it with the right arguments.
jest.mock("@/app/(dashboard)/orders/actions", () => ({ updateOrderStatusAction: jest.fn() }));
const action = updateOrderStatusAction as jest.Mock;

const row = (over: Partial<OrderRowData> & { id: string }): OrderRowData => ({
  status: "PLACED",
  createdAt: "2026-10-20T10:00:00.000Z",
  total: 1000,
  units: 4,
  lines: 2,
  outletName: "Sharma Store",
  repName: "Asha Rao",
  ...over,
});

const ORDERS: OrderRowData[] = [
  row({ id: "ck0000aaa111", status: "PLACED", outletName: "Sharma Store", repName: "Asha Rao", total: 1250.5, units: 5, createdAt: "2026-10-22T10:00:00.000Z" }),
  row({ id: "ck0000bbb222", status: "APPROVED", outletName: "Gupta Mart", repName: "Ravi Kumar", total: 300, units: 1, createdAt: "2026-10-21T10:00:00.000Z" }),
  row({ id: "ck0000ccc333", status: "REJECTED", outletName: "Patel General", repName: "Asha Rao", total: 8000, units: 40, createdAt: "2026-10-20T10:00:00.000Z" }),
  row({ id: "ck0000ddd444", status: "FULFILLED", outletName: "Khan Traders", repName: "Ravi Kumar", total: 50, units: 1, createdAt: "2026-10-19T10:00:00.000Z" }),
];

beforeEach(() => {
  jest.clearAllMocks();
  action.mockResolvedValue({ ok: true });
  window.history.replaceState(null, "", "/orders");
});

const dataRows = () => screen.getAllByRole("row").slice(1); // drop the header row
const rowFor = (label: string) => dataRows().find((r) => within(r).queryByText(label))!;

describe("orders table rendering", () => {
  it("renders one row per order with outlet, rep, units, total, status and short id", () => {
    render(<OrdersTable orders={ORDERS} />);
    expect(dataRows()).toHaveLength(4);

    const sharma = rowFor("Sharma Store");
    expect(within(sharma).getByText("#AAA111")).toBeInTheDocument();
    expect(within(sharma).getByText("Asha Rao")).toBeInTheDocument();
    expect(within(sharma).getByText("5")).toBeInTheDocument();
    expect(within(sharma).getByText("₹1,250.50")).toBeInTheDocument(); // en-IN currency format
    expect(within(sharma).getByText("Placed")).toBeInTheDocument();
    expect(within(rowFor("Gupta Mart")).getByText("Approved")).toBeInTheDocument();
  });

  it("sorts newest first by default", () => {
    render(<OrdersTable orders={ORDERS} />);
    expect(dataRows().map((r) => within(r).getAllByRole("cell")[1]?.textContent)).toEqual([
      "Sharma Store",
      "Gupta Mart",
      "Patel General",
      "Khan Traders",
    ]);
  });

  it("shows status counts on the filter chips", () => {
    render(<OrdersTable orders={ORDERS} />);
    const filters = screen.getByRole("group", { name: "Filter by status" });
    expect(within(filters).getByRole("button", { name: /^All\s*4$/ })).toBeInTheDocument();
    expect(within(filters).getByRole("button", { name: /^Placed\s*1$/ })).toBeInTheDocument();
  });

  it("shows a welcoming empty state when there are no orders at all", () => {
    render(<OrdersTable orders={[]} />);
    expect(screen.getByRole("heading", { name: "No orders yet" })).toBeInTheDocument();
  });
});

describe("filtering, sorting and paging", () => {
  it("filters by status chip", async () => {
    const user = userEvent.setup();
    render(<OrdersTable orders={ORDERS} />);
    await user.click(within(screen.getByRole("group", { name: "Filter by status" })).getByRole("button", { name: /Approved/ }));
    expect(dataRows()).toHaveLength(1);
    expect(screen.getByText("Gupta Mart")).toBeInTheDocument();
  });

  it("searches outlet, rep and order id, and offers Clear filters when nothing matches", async () => {
    const user = userEvent.setup();
    render(<OrdersTable orders={ORDERS} />);
    const search = screen.getByRole("searchbox", { name: "Search orders" });

    await user.type(search, "ravi");
    expect(dataRows()).toHaveLength(2);
    await user.clear(search);
    await user.type(search, "ddd444");
    expect(dataRows()).toHaveLength(1);

    await user.clear(search);
    await user.type(search, "zzz");
    expect(screen.getByRole("heading", { name: "No orders match these filters" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(dataRows()).toHaveLength(4);
  });

  it("sorts by total, and toggles direction on a second click", async () => {
    const user = userEvent.setup();
    render(<OrdersTable orders={ORDERS} />);
    const totals = () => dataRows().map((r) => within(r).getAllByRole("cell")[4]?.textContent);

    await user.click(screen.getByRole("button", { name: /Total/ }));
    expect(totals()).toEqual(["₹8,000.00", "₹1,250.50", "₹300.00", "₹50.00"]); // high → low first
    await user.click(screen.getByRole("button", { name: /Total/ }));
    expect(totals()).toEqual(["₹50.00", "₹300.00", "₹1,250.50", "₹8,000.00"]);
    expect(screen.getByRole("columnheader", { name: /Total/ })).toHaveAttribute("aria-sort", "ascending");
  });

  it("pages 10 at a time", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 23 }, (_, i) =>
      row({ id: `ck${String(i).padStart(9, "0")}`, outletName: `Outlet ${i}`, createdAt: `2026-10-${String(1 + (i % 28)).padStart(2, "0")}T10:00:00.000Z` })
    );
    render(<OrdersTable orders={many} />);
    expect(dataRows()).toHaveLength(10);
    expect(screen.getByText("Showing 1–10 of 23")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(dataRows()).toHaveLength(3);
    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("keeps filters in the URL so Back and shared links restore the view", async () => {
    const user = userEvent.setup();
    render(<OrdersTable orders={ORDERS} />);
    await user.click(within(screen.getByRole("group", { name: "Filter by status" })).getByRole("button", { name: /Rejected/ }));
    expect(window.location.search).toBe("?status=REJECTED");
  });
});

describe("approve / reject actions", () => {
  it("Approve calls the mutation with that order and APPROVED", async () => {
    const user = userEvent.setup();
    render(<OrdersTable orders={ORDERS} />);
    await user.click(screen.getByRole("button", { name: "Approve order #AAA111" }));
    expect(action).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith("ck0000aaa111", "APPROVED");
  });

  it("Reject asks for confirmation first, and only then calls the mutation with REJECTED", async () => {
    const user = userEvent.setup();
    render(<OrdersTable orders={ORDERS} />);
    await user.click(screen.getByRole("button", { name: "Reject order #AAA111" }));
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByText("Reject and return stock?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Yes, reject order #AAA111" }));
    expect(action).toHaveBeenCalledWith("ck0000aaa111", "REJECTED");
  });

  it("cancelling the confirmation sends nothing", async () => {
    const user = userEvent.setup();
    render(<OrdersTable orders={ORDERS} />);
    await user.click(screen.getByRole("button", { name: "Reject order #AAA111" }));
    await user.click(screen.getByRole("button", { name: "Cancel rejecting order #AAA111" }));
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Approve order #AAA111" })).toBeInTheDocument();
  });

  it("an APPROVED order offers only 'Mark fulfilled' (FULFILLED)", async () => {
    const user = userEvent.setup();
    render(<OrdersTable orders={ORDERS} />);
    const approved = rowFor("Gupta Mart");
    expect(within(approved).queryByRole("button", { name: /Approve|Reject/ })).toBeNull();
    await user.click(within(approved).getByRole("button", { name: "Mark fulfilled order #BBB222" }));
    expect(action).toHaveBeenCalledWith("ck0000bbb222", "FULFILLED");
  });

  it("final orders offer no actions at all", () => {
    render(<OrdersTable orders={ORDERS} />);
    for (const outlet of ["Patel General", "Khan Traders"]) {
      expect(within(rowFor(outlet)).queryAllByRole("button")).toHaveLength(0);
      expect(within(rowFor(outlet)).getByText("No further actions")).toBeInTheDocument();
    }
  });

  it("shows the server's message when the change fails, and the row keeps its real status", async () => {
    const user = userEvent.setup();
    action.mockResolvedValue({ ok: false, message: "Invalid status change: APPROVED → REJECTED." });
    render(<OrdersTable orders={ORDERS} />);
    await user.click(screen.getByRole("button", { name: "Approve order #AAA111" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid status change: APPROVED → REJECTED.");
    expect(within(rowFor("Sharma Store")).getByText("Placed")).toBeInTheDocument(); // optimistic change rolled back

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
