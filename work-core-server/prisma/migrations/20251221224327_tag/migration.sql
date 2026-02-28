-- CreateTable
CREATE TABLE "tags" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "severity" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ShiftTags" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ShiftTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE INDEX "_ShiftTags_B_index" ON "_ShiftTags"("B");

-- AddForeignKey
ALTER TABLE "_ShiftTags" ADD CONSTRAINT "_ShiftTags_A_fkey" FOREIGN KEY ("A") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ShiftTags" ADD CONSTRAINT "_ShiftTags_B_fkey" FOREIGN KEY ("B") REFERENCES "work_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
