/*
  Warnings:

  - You are about to drop the column `weekdays_hours` on the `departments` table. All the data in the column will be lost.
  - You are about to drop the column `weekends_hours` on the `departments` table. All the data in the column will be lost.
  - Added the required column `weekdays_closing_time` to the `departments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `weekdays_opening_time` to the `departments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `weekends_closing_time` to the `departments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `weekends_opening_time` to the `departments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "departments" DROP COLUMN "weekdays_hours",
DROP COLUMN "weekends_hours",
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "weekdays_closing_time" TEXT NOT NULL,
ADD COLUMN     "weekdays_opening_time" TEXT NOT NULL,
ADD COLUMN     "weekends_closing_time" TEXT NOT NULL,
ADD COLUMN     "weekends_opening_time" TEXT NOT NULL;
