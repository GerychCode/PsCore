/*
  Warnings:

  - You are about to drop the column `project_id` on the `departments` table. All the data in the column will be lost.
  - You are about to drop the column `project_id` on the `tags` table. All the data in the column will be lost.
  - You are about to drop the `Project` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `project_members` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `project_roles` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `tags` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('Employe', 'Admin');

-- DropForeignKey
ALTER TABLE "departments" DROP CONSTRAINT "departments_project_id_fkey";

-- DropForeignKey
ALTER TABLE "project_members" DROP CONSTRAINT "project_members_project_id_fkey";

-- DropForeignKey
ALTER TABLE "project_members" DROP CONSTRAINT "project_members_role_id_fkey";

-- DropForeignKey
ALTER TABLE "project_members" DROP CONSTRAINT "project_members_user_id_fkey";

-- DropForeignKey
ALTER TABLE "project_roles" DROP CONSTRAINT "project_roles_project_id_fkey";

-- DropForeignKey
ALTER TABLE "tags" DROP CONSTRAINT "tags_project_id_fkey";

-- DropForeignKey
ALTER TABLE "work_schedule" DROP CONSTRAINT "work_schedule_department_id_fkey";

-- DropForeignKey
ALTER TABLE "work_schedule" DROP CONSTRAINT "work_schedule_user_id_fkey";

-- DropForeignKey
ALTER TABLE "work_schedule_locks" DROP CONSTRAINT "work_schedule_locks_department_id_fkey";

-- DropForeignKey
ALTER TABLE "work_shifts" DROP CONSTRAINT "work_shifts_department_id_fkey";

-- DropForeignKey
ALTER TABLE "work_shifts" DROP CONSTRAINT "work_shifts_user_id_fkey";

-- DropIndex
DROP INDEX "tags_project_id_name_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'Employe';

-- AlterTable
ALTER TABLE "departments" DROP COLUMN "project_id";

-- AlterTable
ALTER TABLE "tags" DROP COLUMN "project_id";

-- DropTable
DROP TABLE "Project";

-- DropTable
DROP TABLE "project_members";

-- DropTable
DROP TABLE "project_roles";

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- AddForeignKey
ALTER TABLE "work_shifts" ADD CONSTRAINT "work_shifts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_shifts" ADD CONSTRAINT "work_shifts_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedule" ADD CONSTRAINT "work_schedule_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedule" ADD CONSTRAINT "work_schedule_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedule_locks" ADD CONSTRAINT "work_schedule_locks_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
