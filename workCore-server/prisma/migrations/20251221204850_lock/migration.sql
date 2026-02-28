-- CreateTable
CREATE TABLE "work_schedule_locks" (
    "id" SERIAL NOT NULL,
    "department_id" INTEGER NOT NULL,
    "week_start" TIMESTAMP(3) NOT NULL,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "work_schedule_locks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_schedule_locks_department_id_week_start_key" ON "work_schedule_locks"("department_id", "week_start");

-- AddForeignKey
ALTER TABLE "work_schedule_locks" ADD CONSTRAINT "work_schedule_locks_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
