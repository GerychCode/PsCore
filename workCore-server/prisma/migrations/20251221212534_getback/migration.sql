/*
  Warnings:

  - You are about to drop the column `duration` on the `work_shifts` table. All the data in the column will be lost.
  - You are about to drop the column `endLat` on the `work_shifts` table. All the data in the column will be lost.
  - You are about to drop the column `endLon` on the `work_shifts` table. All the data in the column will be lost.
  - You are about to drop the column `endTime` on the `work_shifts` table. All the data in the column will be lost.
  - You are about to drop the column `isRetroactiveEnd` on the `work_shifts` table. All the data in the column will be lost.
  - You are about to drop the column `isRetroactiveStart` on the `work_shifts` table. All the data in the column will be lost.
  - You are about to drop the column `retroactiveEndReason` on the `work_shifts` table. All the data in the column will be lost.
  - You are about to drop the column `retroactiveStartReason` on the `work_shifts` table. All the data in the column will be lost.
  - You are about to drop the column `startLat` on the `work_shifts` table. All the data in the column will be lost.
  - You are about to drop the column `startLon` on the `work_shifts` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `work_shifts` table. All the data in the column will be lost.
  - Added the required column `date` to the `work_shifts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `end_time` to the `work_shifts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `started_at` to the `work_shifts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total_hours` to the `work_shifts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `work_shifts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "work_shifts" DROP COLUMN "duration",
DROP COLUMN "endLat",
DROP COLUMN "endLon",
DROP COLUMN "endTime",
DROP COLUMN "isRetroactiveEnd",
DROP COLUMN "isRetroactiveStart",
DROP COLUMN "retroactiveEndReason",
DROP COLUMN "retroactiveStartReason",
DROP COLUMN "startLat",
DROP COLUMN "startLon",
DROP COLUMN "startTime",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "end_time" TEXT NOT NULL,
ADD COLUMN     "started_at" TEXT NOT NULL,
ADD COLUMN     "total_hours" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;
