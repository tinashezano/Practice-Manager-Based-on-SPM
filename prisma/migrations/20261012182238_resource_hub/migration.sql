-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('SOP', 'TEMPLATE', 'GUIDE', 'POLICY');

-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "FilePurpose" ADD VALUE 'RESOURCE_ATTACHMENT';

-- AlterTable
ALTER TABLE "StoredFile" ADD COLUMN     "resourceId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "resourceId" TEXT;

-- AlterTable
ALTER TABLE "TemplateTask" ADD COLUMN     "resourceId" TEXT;

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL DEFAULT 'SOP',
    "category" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "videoUrl" TEXT,
    "status" "ResourceStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "ownerId" TEXT,
    "updatedById" TEXT,
    "reviewDue" DATE,
    "reviewNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceVersion" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "changeNote" TEXT,
    "editedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceRead" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Programme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Programme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgrammeStep" (
    "id" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "resourceId" TEXT,
    "dueOffsetDays" INTEGER NOT NULL DEFAULT 0,
    "estimateMinutes" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProgrammeStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mentorId" TEXT,
    "startDate" DATE NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrollmentStep" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "stepId" TEXT,
    "title" TEXT NOT NULL,
    "resourceId" TEXT,
    "taskId" TEXT,
    "completedAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EnrollmentStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Resource_status_category_idx" ON "Resource"("status", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceVersion_resourceId_version_key" ON "ResourceVersion"("resourceId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceRead_resourceId_userId_version_key" ON "ResourceRead"("resourceId", "userId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Programme_name_key" ON "Programme"("name");

-- CreateIndex
CREATE INDEX "Enrollment_userId_status_idx" ON "Enrollment"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentStep_taskId_key" ON "EnrollmentStep"("taskId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateTask" ADD CONSTRAINT "TemplateTask_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceVersion" ADD CONSTRAINT "ResourceVersion_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRead" ADD CONSTRAINT "ResourceRead_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRead" ADD CONSTRAINT "ResourceRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeStep" ADD CONSTRAINT "ProgrammeStep_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeStep" ADD CONSTRAINT "ProgrammeStep_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentStep" ADD CONSTRAINT "EnrollmentStep_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentStep" ADD CONSTRAINT "EnrollmentStep_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "ProgrammeStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentStep" ADD CONSTRAINT "EnrollmentStep_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
