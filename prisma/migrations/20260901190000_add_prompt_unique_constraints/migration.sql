-- MasterPrompts: unique constraint on (name, version) — prevents duplicate
-- version numbers for the same prompt name during parallel updates.
CREATE UNIQUE INDEX "MasterPrompt_name_version_key" ON "MasterPrompt"("name", "version");

-- MasterPromptVersion: unique constraint on (masterPromptId, version) —
-- prevents duplicate version snapshots for the same prompt.
CREATE UNIQUE INDEX "MasterPromptVersion_masterPromptId_version_key" ON "MasterPromptVersion"("masterPromptId", "version");
