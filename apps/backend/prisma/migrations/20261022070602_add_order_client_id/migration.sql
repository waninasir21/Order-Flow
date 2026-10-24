/*
  Warnings:

  - A unique constraint covering the columns `[employeeId,clientId]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_employeeId_clientId_key" ON "Order"("employeeId", "clientId");
