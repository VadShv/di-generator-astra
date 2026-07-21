# Task 6 - Master Prompts (Мастер-промпты) Module

**Agent**: Task 6 Agent  
**Date**: 2025-07-21  
**Status**: ✅ Completed

## What was done:

### API Routes Created:

1. **GET /api/master-prompts** - List all master prompts with filtering support
   - Query params: `?name=xxx&departmentId=yyy&domain=zzz&grade=www&functionType=vvv&isActive=true`
   - Includes department relation in response
   - Ordered by name ASC, version DESC

2. **POST /api/master-prompts** - Create master prompt
   - Body: `{ name, content, departmentId?, domain?, grade?, functionType?, description? }`
   - Auto-increments version if prompt with same name already exists

3. **PUT /api/master-prompts** - Update master prompt
   - Body must include `id`, can update any field
   - Supports toggling `isActive` status

4. **DELETE /api/master-prompts** - Delete master prompt
   - Body must include `id`

5. **POST /api/master-prompts/resolve** - Resolve which master prompt applies for a position
   - Body: `{ positionId }`
   - Priority scoring: departmentId (1000) > domain (100) > grade (10) > functionType (1) > global (0)
   - Returns best matching active prompt with full resolution details
   - Excludes prompts with non-matching specificity requirements

6. **GET /api/master-prompts/versions** - Get all versions of a prompt by name
   - Query: `?name=xxx`
   - Returns versions ordered by version DESC

### Frontend Component:

Created `/src/components/modules/master-prompts.tsx` as `'use client'` component exported as `MasterPromptsModule`.

Features:
- **Stats cards**: Total versions, Active, Groups, With department binding
- **Filter system**: Quick search by name + status filter, expandable advanced filters (department, domain, grade, functionType)
- **Grouped accordion view**: Prompts grouped by name with expandable version lists
- **Version management**: Each group shows active version badge, version count, applicability badges
- **Table per group**: Columns for Version, Department, Domain, Grade, Function, Status, Description, Date, Actions
- **Create/Edit dialog**: 
  - Name, Content (large monospace textarea), Description
  - Applicability rules: Department (dropdown), Domain (with datalist suggestions), Grade (with suggestions), Function Type (with suggestions)
  - Priority visualization showing resolver logic
  - "Create new version" checkbox when editing
- **View dialog**: Full prompt content with applicability badges and metadata
- **Version history dialog**: List of all versions with activate/deactivate, view, and compare actions
- **Diff dialog**: Side-by-side version comparison with highlighted changes (added=green, removed=red strikethrough, changed=yellow/green)
- **Test resolver dialog**: 
  - Position selector with position parameters display
  - Resolution result showing matched prompt, score, match details
  - All evaluated prompts table with scores
  - Priority logic visualization (1000/100/10/1/0 scoring explanation)
- **Actions**: View, Edit, Toggle active, Duplicate, Delete (with confirmation)
- Russian language UI labels
- Loading skeletons, empty states, toast notifications
- Professional design with shadcn/ui components

### Files Created/Modified:
- `/home/z/my-project/src/app/api/master-prompts/route.ts` (new)
- `/home/z/my-project/src/app/api/master-prompts/resolve/route.ts` (new)
- `/home/z/my-project/src/app/api/master-prompts/versions/route.ts` (new)
- `/home/z/my-project/src/components/modules/master-prompts.tsx` (replaced stub with full implementation)

### Verification:
- `bun run lint` passes with no errors
- Dev server compiles successfully
- All API endpoints tested and working correctly
- Version auto-increment confirmed working
- Resolve endpoint confirmed working with scoring logic
- Database schema already in sync (MasterPrompt model was pre-existing)
