// Hand-written for now. Week 7+ can replace these with GraphQL codegen into
// packages/shared-types so a backend schema change becomes a compile error here.
import type { Employee } from "@/stores/auth";

export type OrderStatus = "PLACED" | "APPROVED" | "REJECTED" | "FULFILLED";

export interface Outlet {
  id: string;
  name: string;
  address: string;
  ownerName: string;
  phone: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  stockQuantity: number;
}

export interface OrderItem {
  id: string;
  quantity: number;
  priceAtOrder: number;
  product: { id: string; name: string };
}

export interface Order {
  id: string;
  status: OrderStatus;
  // The local UUID the app generated when it created the order (null for orders placed
  // elsewhere). It links a queued local order to its server copy so the list never
  // shows both.
  clientId: string | null;
  total: number;
  createdAt: string;
  outlet: { id: string; name: string };
  items: OrderItem[];
}

export interface OrderItemInput {
  productId: string;
  quantity: number;
}

export interface LoginData {
  login: { accessToken: string; refreshToken: string; employee: Employee };
}
