-- CreateTable
CREATE TABLE "species" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "name_normalized" VARCHAR(60) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "species_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "species_name_normalized_key" ON "species"("name_normalized");
