/*
  Warnings:

  - Added the required column `date` to the `work_shifts` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `end_time` on the `work_shifts` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "work_shifts" ADD COLUMN     "date" TIMESTAMP(3) NOT NULL,
DROP COLUMN "end_time",
ADD COLUMN     "end_time" TIMESTAMP(3) NOT NULL;
