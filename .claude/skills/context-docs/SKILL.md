---
name: context-docs
description: Maintain CLAUDE.md passive context documentation. Use when adding docs for new features, importing external LLM prompts, or refreshing stale documentation.
allowed-tools: Read, Grep, Glob, Edit, Write
argument-hint: <add|import|refresh|diff> [target]
---

# Context Documentation Maintenance

Maintain CLAUDE.md to provide accurate passive context for AI agents. Based on Vercel's finding that passive context (100% pass rate) outperforms active retrieval (79%).

**Principle:** Documentation must reflect *actual* code patterns, not generic/external docs.

## Commands

Parse `$ARGUMENTS` to determine the subcommand:

### `add <feature-name>`

Analyze implementation and add a condensed section to CLAUDE.md.

**Steps:**
1. Identify key files for the feature (use Glob/Grep to find related code)
2. Read implementation to understand actual patterns used
3. Generate a condensed documentation section with:
   - Key files list with one-line descriptions
   - Project-specific patterns (especially where they differ from standard/generic approaches)
   - Environment variables if applicable
   - Reference to detailed docs if they exist
4. Add section to CLAUDE.md in appropriate location
5. Update Code Index if new files were added

**Output format:**
```markdown
## Feature Name

Brief description of what it does.

**Key files:**
- `path/to/file.ts` - What it does
- `path/to/other.py` - What it does

**Project-specific patterns:**
- Pattern 1 that differs from standard approach
- Pattern 2 specific to this project

**Environment variables:**
- `VAR_NAME` - Description (optional if applicable)

**Research:** `docs/path/to/detailed-docs.md` (if exists)
```

### `import <file-path>`

Adapt an external LLM prompt (like Clerk's, Supabase's, etc.) to project-specific patterns.

**Steps:**
1. Read the external LLM prompt file
2. Identify the technology/library it covers
3. Find actual implementation in this project
4. Compare generic patterns vs actual implementation
5. Generate project-specific documentation that:
   - Keeps relevant guidance
   - Notes where project patterns DIFFER from generic docs
   - Removes irrelevant sections
   - Adds project-specific context
6. Either add to CLAUDE.md or create a reference doc

**Important:** Flag conflicts between external docs and actual code. Project code is authoritative.

### `refresh`

Scan codebase and flag stale documentation in CLAUDE.md.

**Steps:**
1. Read current CLAUDE.md
2. For each documented file/pattern:
   - Verify file still exists at documented path
   - Check if key functions/patterns mentioned still exist
   - Flag line number references that may have shifted
3. Check Code Index against actual files (Glob for patterns)
4. Identify undocumented new files that might need coverage
5. Report findings:
   - Stale references (file moved, deleted, renamed)
   - Missing documentation (new important files)
   - Outdated patterns (code changed but docs didn't)

**Output:** List of issues with suggested fixes, don't auto-fix without user approval.

### `diff`

Show what's documented vs what's actually in the code.

**Steps:**
1. Parse CLAUDE.md sections
2. For each documented feature:
   - Read actual implementation
   - Compare documented patterns with code
   - Note discrepancies
3. Find undocumented patterns (important code not in CLAUDE.md)
4. Generate diff-style report

**Output format:**
```
## Documentation Diff Report

### Auth Section
- Documented: "graceful fallback if key missing"
- Actual: [MATCHES] main.tsx:11-21 implements fallback
- Documented: "custom UserButton component"
- Actual: [MATCHES] UserButton.tsx exists with custom implementation

### Missing Documentation
- backend/app/services/user_service.py - Not documented, handles user sync
- frontend/src/stores/authStore.ts - Not documented, caches user for offline

### Stale References
- Code Index references "CategoryLearning" model but it's now in a different file
```

## Guidelines

1. **Concise over comprehensive** - CLAUDE.md should be scannable, not exhaustive
2. **Patterns over details** - Document "how we do X" not "every line of code"
3. **Differences matter most** - Highlight where project differs from standard approaches
4. **Link to detailed docs** - Reference research docs for deep dives
5. **Keep Code Index current** - It's the quick reference for file purposes
