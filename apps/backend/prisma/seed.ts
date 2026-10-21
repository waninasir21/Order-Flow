import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Idempotent-ish: wipe in FK-safe order, then re-insert.
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.outlet.deleteMany();

  const outlets = await Promise.all(
    [
      { name: "Sharma General Store", address: "12 MG Road, Bengaluru", ownerName: "Rajesh Sharma", phone: "9800000001" },
      { name: "Lakshmi Provisions", address: "45 Bellandur Main Rd, Bengaluru", ownerName: "Lakshmi Iyer", phone: "9800000002" },
      { name: "Khan Kirana", address: "7 Indiranagar 100ft Rd, Bengaluru", ownerName: "Imran Khan", phone: "9800000003" },
    ].map((data) => prisma.outlet.create({ data }))
  );

  // Placeholder hash — real bcrypt hashing arrives in week 2.
  await prisma.employee.create({
    data: {
      name: "Admin User",
      phone: "9900000001",
      passwordHash: "placeholder-week-2",
      role: Role.ADMIN,
    },
  });
  await prisma.employee.create({
    data: {
      name: "Rep One",
      phone: "9900000002",
      passwordHash: "placeholder-week-2",
      role: Role.REP,
      assignedOutlets: { connect: outlets.slice(0, 2).map((o) => ({ id: o.id })) },
    },
  });
  await prisma.employee.create({
    data: {
      name: "Rep Two",
      phone: "9900000003",
      passwordHash: "placeholder-week-2",
      role: Role.REP,
      assignedOutlets: { connect: [{ id: outlets[2]!.id }] },
    },
  });

  await prisma.product.createMany({
    data: [
      { name: "Basmati Rice 5kg", sku: "RICE-5KG", price: "549.00", stockQuantity: 120 },
      { name: "Sunflower Oil 1L", sku: "OIL-1L", price: "142.50", stockQuantity: 300 },
      { name: "Toor Dal 1kg", sku: "DAL-1KG", price: "168.00", stockQuantity: 200 },
      { name: "Tea Powder 500g", sku: "TEA-500G", price: "245.00", stockQuantity: 90 },
    ],
  });

  console.log("Seeded: 3 outlets, 3 employees, 4 products");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
