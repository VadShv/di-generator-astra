-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "code" TEXT NOT NULL,
    "type" TEXT,
    "inn" TEXT,
    "ogrn" TEXT,
    "kpp" TEXT,
    "legalAddress" TEXT,
    "actualAddress" TEXT,
    "director" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "parentId" TEXT,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessFunction" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessFunction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "entityType" TEXT,
    "entityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionAttribute" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "promptAddition" TEXT NOT NULL,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PositionAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffingTable" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "positionTitle" TEXT NOT NULL,
    "positionCode" TEXT,
    "positionId" TEXT,
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffingTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "grade" TEXT,
    "businessFunctionId" TEXT,
    "projectId" TEXT,
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "functions" TEXT,
    "staffingTableId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchiveDI" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "positionId" TEXT,
    "fileName" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchiveDI_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedDocument" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "filePath" TEXT,
    "rawText" TEXT NOT NULL,
    "parsedSections" TEXT NOT NULL DEFAULT '[]',
    "positionId" TEXT,
    "companyId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DITemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DITemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DITemplateSection" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "promptGuidance" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DITemplateSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedDI" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "templateId" TEXT,
    "sourceArchiveId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "signedByEmployee" BOOLEAN NOT NULL DEFAULT false,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedDI_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedDISection" (
    "id" TEXT NOT NULL,
    "generatedDIId" TEXT NOT NULL,
    "sectionTitle" TEXT NOT NULL,
    "sectionContent" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT true,
    "editedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedDISection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DITracking" (
    "id" TEXT NOT NULL,
    "generatedDIId" TEXT,
    "departmentId" TEXT,
    "positionId" TEXT,
    "status" TEXT NOT NULL,
    "assignee" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DITracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingTag" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'status',
    "color" TEXT NOT NULL DEFAULT 'amber',
    "assignee" TEXT,
    "dueDate" TIMESTAMP(3),
    "note" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackingTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "actionType" TEXT NOT NULL DEFAULT 'note',
    "entityType" TEXT,
    "entityId" TEXT,
    "tagId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "author" TEXT,
    "generatedDIId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DIVersion" (
    "id" TEXT NOT NULL,
    "generatedDIId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isOriginal" BOOLEAN NOT NULL DEFAULT false,
    "uploadedBy" TEXT,
    "fileName" TEXT,
    "diffSummary" TEXT,
    "changeDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DIVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DIAuditResult" (
    "id" TEXT NOT NULL,
    "generatedDIId" TEXT NOT NULL,
    "auditType" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL DEFAULT 0,
    "duplicatedTkItems" TEXT NOT NULL DEFAULT '[]',
    "vagueFormulationItems" TEXT NOT NULL DEFAULT '[]',
    "legislativeConflictItems" TEXT NOT NULL DEFAULT '[]',
    "unrealisticRequirementItems" TEXT NOT NULL DEFAULT '[]',
    "incompleteSectionItems" TEXT NOT NULL DEFAULT '[]',
    "outdatedItems" TEXT NOT NULL DEFAULT '[]',
    "contradictoryItems" TEXT NOT NULL DEFAULT '[]',
    "riskyItems" TEXT NOT NULL DEFAULT '[]',
    "recommendations" TEXT NOT NULL DEFAULT '[]',
    "summary" TEXT,
    "auditedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DIAuditResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DIStatusChange" (
    "id" TEXT NOT NULL,
    "generatedDIId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "comment" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DIStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterPrompt" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'generation',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isAiCulture" BOOLEAN NOT NULL DEFAULT false,
    "variables" TEXT NOT NULL DEFAULT '[]',
    "departmentId" TEXT,
    "businessFunctionId" TEXT,
    "grade" TEXT,
    "functionType" TEXT,
    "description" TEXT,
    "companyId" TEXT,
    "positionId" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "estimatedTokens" INTEGER,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterPromptVersion" (
    "id" TEXT NOT NULL,
    "masterPromptId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "description" TEXT,
    "diff" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterPromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptChain" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "steps" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptChain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptTestResult" (
    "id" TEXT NOT NULL,
    "masterPromptId" TEXT NOT NULL,
    "positionId" TEXT,
    "providerId" TEXT,
    "response" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptTestResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "baseUrl" TEXT,
    "apiKeyEncrypted" TEXT,
    "modelName" TEXT NOT NULL,
    "folderId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "config" TEXT NOT NULL DEFAULT '{}',
    "lastTestedAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "lastTestMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationJob" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeData" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "total" INTEGER NOT NULL DEFAULT 0,
    "completed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "results" TEXT NOT NULL DEFAULT '[]',
    "providerId" TEXT,
    "templateId" TEXT,
    "masterPromptId" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "permissions" TEXT,
    "passwordHash" TEXT NOT NULL,
    "passwordChangedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenUsage" (
    "id" TEXT NOT NULL,
    "providerId" TEXT,
    "providerName" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "category" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "generatedDIId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "action" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionLineage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PositionLineage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionLineageItem" (
    "id" TEXT NOT NULL,
    "lineageId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "levelLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PositionLineageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalReference" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "article" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "category" TEXT,
    "relatedPositionCodes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RACIMatrix" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "zones" TEXT NOT NULL,
    "generatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RACIMatrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PositionToPositionAttribute" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PositionToPositionAttribute_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- CreateIndex
CREATE INDEX "Company_inn_idx" ON "Company"("inn");

-- CreateIndex
CREATE INDEX "Company_name_idx" ON "Company"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE INDEX "Department_companyId_idx" ON "Department"("companyId");

-- CreateIndex
CREATE INDEX "Department_parentId_idx" ON "Department"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessFunction_name_key" ON "BusinessFunction"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Project_name_key" ON "Project"("name");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PositionAttribute_code_key" ON "PositionAttribute"("code");

-- CreateIndex
CREATE INDEX "PositionAttribute_isActive_idx" ON "PositionAttribute"("isActive");

-- CreateIndex
CREATE INDEX "PositionAttribute_category_idx" ON "PositionAttribute"("category");

-- CreateIndex
CREATE INDEX "StaffingTable_departmentId_idx" ON "StaffingTable"("departmentId");

-- CreateIndex
CREATE INDEX "StaffingTable_positionId_idx" ON "StaffingTable"("positionId");

-- CreateIndex
CREATE INDEX "StaffingTable_companyId_idx" ON "StaffingTable"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Position_code_key" ON "Position"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Position_staffingTableId_key" ON "Position"("staffingTableId");

-- CreateIndex
CREATE INDEX "Position_departmentId_idx" ON "Position"("departmentId");

-- CreateIndex
CREATE INDEX "Position_businessFunctionId_idx" ON "Position"("businessFunctionId");

-- CreateIndex
CREATE INDEX "Position_grade_idx" ON "Position"("grade");

-- CreateIndex
CREATE INDEX "ArchiveDI_positionId_idx" ON "ArchiveDI"("positionId");

-- CreateIndex
CREATE INDEX "ArchiveDI_uploadedAt_idx" ON "ArchiveDI"("uploadedAt");

-- CreateIndex
CREATE INDEX "UploadedDocument_positionId_idx" ON "UploadedDocument"("positionId");

-- CreateIndex
CREATE INDEX "UploadedDocument_companyId_idx" ON "UploadedDocument"("companyId");

-- CreateIndex
CREATE INDEX "UploadedDocument_status_idx" ON "UploadedDocument"("status");

-- CreateIndex
CREATE INDEX "DITemplate_isPrimary_idx" ON "DITemplate"("isPrimary");

-- CreateIndex
CREATE INDEX "DITemplateSection_templateId_idx" ON "DITemplateSection"("templateId");

-- CreateIndex
CREATE INDEX "GeneratedDI_positionId_idx" ON "GeneratedDI"("positionId");

-- CreateIndex
CREATE INDEX "GeneratedDI_status_idx" ON "GeneratedDI"("status");

-- CreateIndex
CREATE INDEX "GeneratedDI_templateId_idx" ON "GeneratedDI"("templateId");

-- CreateIndex
CREATE INDEX "GeneratedDI_sourceArchiveId_idx" ON "GeneratedDI"("sourceArchiveId");

-- CreateIndex
CREATE INDEX "GeneratedDI_createdAt_idx" ON "GeneratedDI"("createdAt");

-- CreateIndex
CREATE INDEX "GeneratedDISection_generatedDIId_idx" ON "GeneratedDISection"("generatedDIId");

-- CreateIndex
CREATE INDEX "DITracking_departmentId_idx" ON "DITracking"("departmentId");

-- CreateIndex
CREATE INDEX "DITracking_positionId_idx" ON "DITracking"("positionId");

-- CreateIndex
CREATE INDEX "DITracking_status_idx" ON "DITracking"("status");

-- CreateIndex
CREATE INDEX "DITracking_generatedDIId_idx" ON "DITracking"("generatedDIId");

-- CreateIndex
CREATE INDEX "TrackingTag_entityType_entityId_idx" ON "TrackingTag"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "TrackingTag_isResolved_idx" ON "TrackingTag"("isResolved");

-- CreateIndex
CREATE INDEX "TrackingTag_assignee_idx" ON "TrackingTag"("assignee");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ActivityLog_tagId_idx" ON "ActivityLog"("tagId");

-- CreateIndex
CREATE INDEX "ActivityLog_generatedDIId_idx" ON "ActivityLog"("generatedDIId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "DIVersion_generatedDIId_idx" ON "DIVersion"("generatedDIId");

-- CreateIndex
CREATE INDEX "DIVersion_createdAt_idx" ON "DIVersion"("createdAt");

-- CreateIndex
CREATE INDEX "DIAuditResult_generatedDIId_idx" ON "DIAuditResult"("generatedDIId");

-- CreateIndex
CREATE INDEX "DIStatusChange_generatedDIId_idx" ON "DIStatusChange"("generatedDIId");

-- CreateIndex
CREATE INDEX "DIStatusChange_createdAt_idx" ON "DIStatusChange"("createdAt");

-- CreateIndex
CREATE INDEX "MasterPrompt_category_idx" ON "MasterPrompt"("category");

-- CreateIndex
CREATE INDEX "MasterPrompt_isActive_idx" ON "MasterPrompt"("isActive");

-- CreateIndex
CREATE INDEX "MasterPrompt_name_idx" ON "MasterPrompt"("name");

-- CreateIndex
CREATE INDEX "MasterPrompt_companyId_idx" ON "MasterPrompt"("companyId");

-- CreateIndex
CREATE INDEX "MasterPrompt_positionId_idx" ON "MasterPrompt"("positionId");

-- CreateIndex
CREATE INDEX "MasterPromptVersion_masterPromptId_idx" ON "MasterPromptVersion"("masterPromptId");

-- CreateIndex
CREATE INDEX "PromptChain_isActive_idx" ON "PromptChain"("isActive");

-- CreateIndex
CREATE INDEX "PromptTestResult_masterPromptId_idx" ON "PromptTestResult"("masterPromptId");

-- CreateIndex
CREATE INDEX "PromptTestResult_positionId_idx" ON "PromptTestResult"("positionId");

-- CreateIndex
CREATE INDEX "AIProvider_type_idx" ON "AIProvider"("type");

-- CreateIndex
CREATE INDEX "AIProvider_isActive_idx" ON "AIProvider"("isActive");

-- CreateIndex
CREATE INDEX "GenerationJob_providerId_idx" ON "GenerationJob"("providerId");

-- CreateIndex
CREATE INDEX "GenerationJob_masterPromptId_idx" ON "GenerationJob"("masterPromptId");

-- CreateIndex
CREATE INDEX "GenerationJob_status_idx" ON "GenerationJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSettings_key_key" ON "SystemSettings"("key");

-- CreateIndex
CREATE INDEX "TokenUsage_providerId_idx" ON "TokenUsage"("providerId");

-- CreateIndex
CREATE INDEX "TokenUsage_userId_idx" ON "TokenUsage"("userId");

-- CreateIndex
CREATE INDEX "TokenUsage_category_idx" ON "TokenUsage"("category");

-- CreateIndex
CREATE INDEX "TokenUsage_createdAt_idx" ON "TokenUsage"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "PositionLineage_departmentId_idx" ON "PositionLineage"("departmentId");

-- CreateIndex
CREATE INDEX "PositionLineageItem_lineageId_idx" ON "PositionLineageItem"("lineageId");

-- CreateIndex
CREATE UNIQUE INDEX "PositionLineageItem_lineageId_positionId_key" ON "PositionLineageItem"("lineageId", "positionId");

-- CreateIndex
CREATE INDEX "LegalReference_type_idx" ON "LegalReference"("type");

-- CreateIndex
CREATE INDEX "LegalReference_article_idx" ON "LegalReference"("article");

-- CreateIndex
CREATE INDEX "LegalReference_category_idx" ON "LegalReference"("category");

-- CreateIndex
CREATE UNIQUE INDEX "RACIMatrix_departmentId_key" ON "RACIMatrix"("departmentId");

-- CreateIndex
CREATE INDEX "_PositionToPositionAttribute_B_index" ON "_PositionToPositionAttribute"("B");

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffingTable" ADD CONSTRAINT "StaffingTable_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffingTable" ADD CONSTRAINT "StaffingTable_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_businessFunctionId_fkey" FOREIGN KEY ("businessFunctionId") REFERENCES "BusinessFunction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_staffingTableId_fkey" FOREIGN KEY ("staffingTableId") REFERENCES "StaffingTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchiveDI" ADD CONSTRAINT "ArchiveDI_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedDocument" ADD CONSTRAINT "UploadedDocument_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedDocument" ADD CONSTRAINT "UploadedDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DITemplateSection" ADD CONSTRAINT "DITemplateSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DITemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDI" ADD CONSTRAINT "GeneratedDI_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDI" ADD CONSTRAINT "GeneratedDI_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DITemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDI" ADD CONSTRAINT "GeneratedDI_sourceArchiveId_fkey" FOREIGN KEY ("sourceArchiveId") REFERENCES "ArchiveDI"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDISection" ADD CONSTRAINT "GeneratedDISection_generatedDIId_fkey" FOREIGN KEY ("generatedDIId") REFERENCES "GeneratedDI"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DITracking" ADD CONSTRAINT "DITracking_generatedDIId_fkey" FOREIGN KEY ("generatedDIId") REFERENCES "GeneratedDI"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DITracking" ADD CONSTRAINT "DITracking_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DITracking" ADD CONSTRAINT "DITracking_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "TrackingTag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DIVersion" ADD CONSTRAINT "DIVersion_generatedDIId_fkey" FOREIGN KEY ("generatedDIId") REFERENCES "GeneratedDI"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DIAuditResult" ADD CONSTRAINT "DIAuditResult_generatedDIId_fkey" FOREIGN KEY ("generatedDIId") REFERENCES "GeneratedDI"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DIStatusChange" ADD CONSTRAINT "DIStatusChange_generatedDIId_fkey" FOREIGN KEY ("generatedDIId") REFERENCES "GeneratedDI"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterPrompt" ADD CONSTRAINT "MasterPrompt_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterPrompt" ADD CONSTRAINT "MasterPrompt_businessFunctionId_fkey" FOREIGN KEY ("businessFunctionId") REFERENCES "BusinessFunction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterPrompt" ADD CONSTRAINT "MasterPrompt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterPrompt" ADD CONSTRAINT "MasterPrompt_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterPromptVersion" ADD CONSTRAINT "MasterPromptVersion_masterPromptId_fkey" FOREIGN KEY ("masterPromptId") REFERENCES "MasterPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptTestResult" ADD CONSTRAINT "PromptTestResult_masterPromptId_fkey" FOREIGN KEY ("masterPromptId") REFERENCES "MasterPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "AIProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DITemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_masterPromptId_fkey" FOREIGN KEY ("masterPromptId") REFERENCES "MasterPrompt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionLineage" ADD CONSTRAINT "PositionLineage_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionLineageItem" ADD CONSTRAINT "PositionLineageItem_lineageId_fkey" FOREIGN KEY ("lineageId") REFERENCES "PositionLineage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionLineageItem" ADD CONSTRAINT "PositionLineageItem_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RACIMatrix" ADD CONSTRAINT "RACIMatrix_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PositionToPositionAttribute" ADD CONSTRAINT "_PositionToPositionAttribute_A_fkey" FOREIGN KEY ("A") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PositionToPositionAttribute" ADD CONSTRAINT "_PositionToPositionAttribute_B_fkey" FOREIGN KEY ("B") REFERENCES "PositionAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
