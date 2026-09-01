-- PromptChainRunResult: new model for storing chain run results (Phase 3 / M5)
CREATE TABLE "PromptChainRunResult" (
    "id" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "positionId" TEXT,
    "providerId" TEXT,
    "totalSteps" INTEGER NOT NULL,
    "completedSteps" INTEGER NOT NULL,
    "results" TEXT NOT NULL DEFAULT '[]',
    "finalOutput" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptChainRunResult_pkey" PRIMARY KEY ("id")
);

-- FK: chain → PromptChain (cascade on delete)
ALTER TABLE "PromptChainRunResult"
    ADD CONSTRAINT "PromptChainRunResult_chainId_fkey"
    FOREIGN KEY ("chainId") REFERENCES "PromptChain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FK: positionId → Position (set null on delete, no back-relation added)
ALTER TABLE "PromptChainRunResult"
    ADD CONSTRAINT "PromptChainRunResult_positionId_fkey"
    FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- FK: providerId → AIProvider (set null on delete)
ALTER TABLE "PromptChainRunResult"
    ADD CONSTRAINT "PromptChainRunResult_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "AIProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "PromptChainRunResult_chainId_idx" ON "PromptChainRunResult"("chainId");
CREATE INDEX "PromptChainRunResult_positionId_idx" ON "PromptChainRunResult"("positionId");

-- PromptTestResult: add FK relation to AIProvider (Phase 3 / M6)
-- providerId already exists as a plain column; just add the foreign key constraint.
ALTER TABLE "PromptTestResult"
    ADD CONSTRAINT "PromptTestResult_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "AIProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
