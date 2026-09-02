-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE');

-- CreateEnum
CREATE TYPE "Caste" AS ENUM ('General', 'OBC', 'SC', 'ST', 'EWS', 'Other');

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "blood_group" "BloodGroup",
ADD COLUMN     "caste" "Caste";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "profession" TEXT;
