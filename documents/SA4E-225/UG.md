# User Guide (UG)

## SA4E-225: Regex Symbol Extraction for 9 Languages + PowerShell Indexing

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | SA4E-225 |
| Title | Regex-based symbol extraction for Scala, C, C++, C#, Ruby, PHP, Swift, Bash, PowerShell; PowerShell (.ps1) files now indexable |
| Author | DEV Agent |
| Version | 1.0 |
| Date | 2026-08-28 |
| Status | Draft |

---

## 1. Introduction

### 1.1 Purpose

This release improves the **code-intel indexer** with proper symbol extraction for 9 additional programming languages and makes PowerShell files indexable. There is **no UI, CLI, or configuration change** — it is an internal indexing improvement. Users benefit automatically when their repository is indexed.

### 1.2 What Changed

| Change | Description |
|--------|-------------|
| New language support | Symbol extraction (classes, functions, methods, interfaces, etc.) now works for: **Scala, C, C++, C#, Ruby, PHP, Swift, Bash, PowerShell** |
| PowerShell indexing | `.ps1` files are now discovered and indexed by the indexer |
| Extraction method | These 9 languages use **regex-based** extraction (not tree-sitter) |

### 1.3 Audience

| Audience | What They Get |
|----------|---------------|
| AI Agent / End User | Better symbol search & code context for repos in the languages above |
| Developer / Administrator | No action required — improvement is automatic on next index run |

---

## 2. How to Verify It Works

### 2.1 Option A — Index a Repo

```bash
# Run the indexer against a repo that contains one of the supported languages
npm run index

# Then search for a known symbol, e.g. a class or function in a .scala / .cpp / .cs file
# Expected: matching symbols (classes, functions, etc.) appear in results
```

### 2.2 Option B — Run the Test Suite

```bash
# The SA4E-225 unit tests cover symbol extraction for all 9 languages
npm run test:unit
```

A green test run confirms correct extraction for each language.

---

## 3. Limitations

| Language | Symbol Kinds Extracted | Notes |
|----------|------------------------|-------|
| Scala, C, C++, C#, Ruby, PHP, Swift | Multiple (classes, functions, methods, interfaces, etc.) | Regex-based |
| **Bash** | **3** kinds | By design (functions, variables, etc.) |
| **PowerShell** | **4** kinds | By design; `.ps1` files now indexed |

- These 9 languages use **regex extraction**, not tree-sitter AST parsing. Results are heuristic and may miss symbols in unusual syntax.
- No new configuration options were added; existing indexer settings apply unchanged.

---

## 4. Troubleshooting

| Symptom | Cause | Solution |
|---------|-------|----------|
| Symbols missing for one of the 9 languages | Unusual/non-standard syntax not matched by regex | Acceptable limitation; report specific cases if critical |
| `.ps1` files not indexed | Using an older indexer build | Ensure SA4E-225 changes are deployed, then re-run `npm run index` |

---

## 5. FAQ

**Q: Do I need to change any config to enable this?**
A: No. The improvement is active automatically once the updated indexer is running.

**Q: Why are Bash/PowerShell limited to 3/4 symbol kinds?**
A: By design — these languages have fewer well-defined symbol constructs; regex extraction targets the most common ones.

---

## 6. Related Documents

| Document | Location |
|----------|----------|
| TDD | TDD-v1.0-SA4E-225.docx |
| STC | STC-v1.0-SA4E-225.docx |
