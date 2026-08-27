-- CreateEnum
CREATE TYPE "AnimalSize" AS ENUM ('PEQUENO', 'MEDIO', 'GRANDE');

-- CreateEnum
CREATE TYPE "AnimalSex" AS ENUM ('MACHO', 'FEMEA');

-- CreateEnum
CREATE TYPE "AnimalStatus" AS ENUM ('DISPONIVEL', 'RESERVADO', 'ADOTADO', 'INDISPONIVEL');

-- CreateTable
CREATE TABLE "states" (
    "id" UUID NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "name" VARCHAR(60) NOT NULL,

    CONSTRAINT "states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" UUID NOT NULL,
    "state_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "ibge_code" INTEGER NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animals" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "name_normalized" VARCHAR(60) NOT NULL,
    "species_id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "size" "AnimalSize" NOT NULL,
    "sex" "AnimalSex" NOT NULL,
    "status" "AnimalStatus" NOT NULL DEFAULT 'DISPONIVEL',
    "birth_date" DATE,
    "description" VARCHAR(1000),
    "accepts_other_animals" BOOLEAN NOT NULL DEFAULT false,
    "needs_large_space" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "animals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animal_images" (
    "id" UUID NOT NULL,
    "animal_id" UUID NOT NULL,
    "storage_path" VARCHAR(255) NOT NULL,
    "position" INTEGER NOT NULL,
    "content_type" VARCHAR(30) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animal_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "states_uf_key" ON "states"("uf");

-- CreateIndex
CREATE UNIQUE INDEX "cities_ibge_code_key" ON "cities"("ibge_code");

-- CreateIndex
CREATE INDEX "cities_state_id_name_idx" ON "cities"("state_id", "name");

-- CreateIndex
CREATE INDEX "animals_name_normalized_created_at_id_idx" ON "animals"("name_normalized", "created_at", "id");

-- CreateIndex
CREATE INDEX "animals_species_id_idx" ON "animals"("species_id");

-- CreateIndex
CREATE INDEX "animals_city_id_idx" ON "animals"("city_id");

-- CreateIndex
CREATE INDEX "animals_status_idx" ON "animals"("status");

-- CreateIndex
CREATE INDEX "animal_images_animal_id_position_idx" ON "animal_images"("animal_id", "position");

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animals" ADD CONSTRAINT "animals_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animals" ADD CONSTRAINT "animals_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_images" ADD CONSTRAINT "animal_images_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
