/*
  Warnings:

  - You are about to drop the column `created_at` on the `work_shifts` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `work_shifts` table. All the data in the column will be lost.
  - You are about to drop the column `end_time` on the `work_shifts` table. All the data in the column will be lost.
  - You are about to drop the column `started_at` on the `work_shifts` table. All the data in the column will be lost.
  - You are about to drop the column `total_hours` on the `work_shifts` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `work_shifts` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[telegramId]` on the table `departments` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `startTime` to the `work_shifts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "telegramId" INTEGER;

-- AlterTable
ALTER TABLE "work_shifts" DROP COLUMN "created_at",
DROP COLUMN "date",
DROP COLUMN "end_time",
DROP COLUMN "started_at",
DROP COLUMN "total_hours",
DROP COLUMN "updated_at",
ADD COLUMN     "duration" TEXT,
ADD COLUMN     "endLat" DOUBLE PRECISION,
ADD COLUMN     "endLon" DOUBLE PRECISION,
ADD COLUMN     "endTime" TIMESTAMP(3),
ADD COLUMN     "isRetroactiveEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isRetroactiveStart" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retroactiveEndReason" TEXT,
ADD COLUMN     "retroactiveStartReason" TEXT,
ADD COLUMN     "startLat" DOUBLE PRECISION,
ADD COLUMN     "startLon" DOUBLE PRECISION,
ADD COLUMN     "startTime" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "departments_telegramId_key" ON "departments"("telegramId");
