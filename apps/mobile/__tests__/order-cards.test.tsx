import { render, screen } from "@testing-library/react-native";
import { OrderRow, StatusBadge } from "@/components/OrderRow";
import { PendingOrderCard } from "@/components/PendingOrderCard";
import type { Order, OrderStatus } from "@/graphql/types";
import type { PendingOrder } from "@/offline/outbox";
import { lightPalette } from "@/theme/tokens";

const order: Order = {
  id: "ckxyz123456",
  status: "PLACED",
  clientId: null,
  total: 245.5,
  createdAt: "2026-10-01T10:00:00.000Z",
  outlet: { id: "o1", name: "Sharma Store" },
  items: [
    { id: "i1", quantity: 2, priceAtOrder: 50, product: { id: "p1", name: "Biscuits" } },
    { id: "i2", quantity: 1, priceAtOrder: 145.5, product: { id: "p2", name: "Soap" } },
  ],
};

const pending = (over: Partial<PendingOrder> = {}): PendingOrder => ({
  id: "local-1",
  employeeId: "e1",
  outletId: "o1",
  outletName: "Sharma Store",
  items: [{ productId: "p1", name: "Biscuits", price: 10, quantity: 3 }],
  total: 30,
  createdAt: "2026-10-01T10:00:00.000Z",
  syncStatus: "PENDING",
  errorMessage: null,
  ...over,
});

describe("server order card", () => {
  it("shows the outlet, line items, item count and total", async () => {
    await render(<OrderRow order={order} />);
    expect(screen.getByText("Sharma Store")).toBeTruthy();
    expect(screen.getByText("2× Biscuits, 1× Soap")).toBeTruthy();
    expect(screen.getByText(/3 items/)).toBeTruthy();
    expect(screen.getByText("₹245.50")).toBeTruthy();
  });

  it("uses singular wording for one item and an order id when the outlet is hidden", async () => {
    const single = { ...order, items: [{ ...order.items[0]!, quantity: 1 }] };
    await render(<OrderRow order={single} showOutlet={false} />);
    expect(screen.getByText(/1 item ·/)).toBeTruthy();
    expect(screen.getByText("Order 123456")).toBeTruthy();
  });

  it.each<[OrderStatus, string]>([
    ["PLACED", "Placed"],
    ["APPROVED", "Approved"],
    ["REJECTED", "Rejected"],
    ["FULFILLED", "Fulfilled"],
  ])("renders the %s status with its label and colours", async (status, label) => {
    await render(<StatusBadge status={status} />);
    const badge = screen.getByLabelText(`Status: ${label}`);
    expect(badge).toBeTruthy();
    expect(screen.getByText(status)).toBeTruthy();
    const colors = lightPalette.status[status];
    expect(badge).toHaveStyle({ backgroundColor: colors.bg });
    expect(screen.getByText(status)).toHaveStyle({ color: colors.fg });
  });
});

describe("pending (offline) order card", () => {
  it("PENDING: says it is saved on the phone and offers Cancel only", async () => {
    await render(<PendingOrderCard pending={pending()} />);
    expect(screen.getByLabelText("Sync status: Waiting to sync")).toBeTruthy();
    expect(screen.getByText(/Saved on this phone/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel order" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("SYNCING: shows progress with no actions (it can no longer be cancelled)", async () => {
    await render(<PendingOrderCard pending={pending({ syncStatus: "SYNCING" })} />);
    expect(screen.getByLabelText("Sync status: Syncing…")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("FAILED: shows the server's reason with Retry and Discard", async () => {
    await render(
      <PendingOrderCard pending={pending({ syncStatus: "FAILED", errorMessage: "Insufficient stock for Biscuits" })} />
    );
    expect(screen.getByLabelText("Sync status: Sync failed")).toBeTruthy();
    expect(screen.getByText("Insufficient stock for Biscuits")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Discard" })).toBeTruthy();
  });
});
