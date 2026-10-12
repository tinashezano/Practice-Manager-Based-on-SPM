-- CreateEnum
CREATE TYPE "FilePurpose" AS ENUM ('SIGNED_PROPOSAL', 'CLIENT_DOCUMENT', 'TASK_ATTACHMENT');

-- CreateEnum
CREATE TYPE "OnboardingStage" AS ENUM ('INFO_REQUESTED', 'INFO_RECEIVED', 'SETUP', 'REVIEW', 'COMPLETE');

-- CreateEnum
CREATE TYPE "OnboardingItemKind" AS ENUM ('INFO', 'SETUP');

-- CreateEnum
CREATE TYPE "OnboardingItemStatus" AS ENUM ('PENDING', 'RECEIVED', 'ACCEPTED', 'REJECTED', 'NOT_APPLICABLE', 'DONE');

-- AlterTable
ALTER TABLE "StoredFile" ADD COLUMN     "purpose" "FilePurpose" NOT NULL DEFAULT 'SIGNED_PROPOSAL',
ADD COLUMN     "uploadedByClient" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TaskAttachment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Onboarding" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "stage" "OnboardingStage" NOT NULL DEFAULT 'INFO_REQUESTED',
    "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT,
    "reviewerId" TEXT,
    "proposalId" TEXT,
    "uploadToken" TEXT NOT NULL,
    "remindersSent" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Onboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingItem" (
    "id" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "kind" "OnboardingItemKind" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "allowsText" BOOLEAN NOT NULL DEFAULT false,
    "status" "OnboardingItemStatus" NOT NULL DEFAULT 'PENDING',
    "clientAnswer" TEXT,
    "staffNote" TEXT,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OnboardingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingFile" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingActivity" (
    "id" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actorId" TEXT,
    "byClient" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskAttachment_fileId_key" ON "TaskAttachment"("fileId");

-- CreateIndex
CREATE INDEX "TaskAttachment_taskId_idx" ON "TaskAttachment"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "Onboarding_uploadToken_key" ON "Onboarding"("uploadToken");

-- CreateIndex
CREATE INDEX "Onboarding_stage_idx" ON "Onboarding"("stage");

-- CreateIndex
CREATE INDEX "OnboardingItem_onboardingId_kind_idx" ON "OnboardingItem"("onboardingId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingFile_fileId_key" ON "OnboardingFile"("fileId");

-- CreateIndex
CREATE INDEX "OnboardingActivity_onboardingId_createdAt_idx" ON "OnboardingActivity"("onboardingId", "createdAt");

-- AddForeignKey
ALTER TABLE "TaskAttachment" ADD CONSTRAINT "TaskAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAttachment" ADD CONSTRAINT "TaskAttachment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Onboarding" ADD CONSTRAINT "Onboarding_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingItem" ADD CONSTRAINT "OnboardingItem_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "Onboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingFile" ADD CONSTRAINT "OnboardingFile_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "OnboardingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingFile" ADD CONSTRAINT "OnboardingFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingActivity" ADD CONSTRAINT "OnboardingActivity_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "Onboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
