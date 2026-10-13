-- AlterEnum
ALTER TYPE "FilePurpose" ADD VALUE 'PUBLIC_ASSET';

-- AlterTable
ALTER TABLE "FirmSettings" ADD COLUMN     "proposalTemplate" JSONB;

-- AlterTable
ALTER TABLE "Proposal" ADD COLUMN     "content" JSONB;
