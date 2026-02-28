-- CreateTable
CREATE TABLE "departments" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "weekdays_hours" TEXT NOT NULL,
    "weekends_hours" TEXT NOT NULL,
    "address" TEXT,
    "is_active" BOOLEAN DEFAULT true,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);
