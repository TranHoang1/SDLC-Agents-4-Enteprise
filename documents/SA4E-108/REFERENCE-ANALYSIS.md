# Reference Analysis — SA4E-108

## Pattern: "Project-Type Detection + Type-Aware Indexing Strategy"

### Reference 1: IntelliJ IDEA / JetBrains IDEs
- **URL**: https://github.com/JetBrains/intellij-community
- **Architecture**: Detects project type from build files (pom.xml, build.gradle, package.json) at project open. Each project type has a "Project SDK" and "Module Facet" system.
- **Key patterns**:
  - `ProjectTypeDetector` interface with `detectProjectType(rootDir)` method
  - Each language plugin registers its own detector (Maven detector, Gradle detector, etc.)
  - Strategy pattern: `IndexingStrategy` per project type with source roots, test roots, excludes
  - Caches detected type in `.idea/` project config
  - Supports multi-module projects (mono-repo) with different types per module
- **Strengths**: Mature, handles edge cases (multiple build files, nested projects)
- **Relevant for SA4E-108**: Strategy pattern for indexing rules per project type

### Reference 2: SonarQube Scanner
- **URL**: https://github.com/SonarSource/sonar-scanner-engine
- **Architecture**: `ProjectTypeAnalyzer` detects language/build-tool from file signatures. Applies type-specific source/test separation and exclusion rules.
- **Key patterns**:
  - Ordered list of `ProjectDetector` implementations (highest-priority first)
  - Each detector returns confidence score (0.0-1.0)
  - Highest-confidence detector wins
  - `SourceRoot` concept: directories where source lives vs. generated code
  - `ExclusionPattern` per project type (build output, deps, caches)
  - Handles polyglot projects: multiple languages detected, merge strategies
- **Strengths**: Confidence-based detection, handles ambiguous cases
- **Relevant for SA4E-108**: Confidence scoring when multiple build files present

### Reference 3: GitHub Linguist
- **URL**: https://github.com/github-linguist/linguist
- **Architecture**: Detects repository language composition. Uses heuristics (file extensions + content patterns + vendor detection).
- **Key patterns**:
  - `vendor/` directory detection to exclude third-party code
  - `generated.rb` patterns to exclude auto-generated files
  - Language-specific heuristics beyond just file extension
  - `.gitattributes` override mechanism
  - Statistics-based: primary language = most bytes of source code
- **Strengths**: Handles vendor detection, generated code filtering
- **Relevant for SA4E-108**: Vendor/generated file exclusion heuristics

### Reference 4: Nx/Turborepo (Mono-repo tools)
- **URL**: https://github.com/nrwl/nx
- **Architecture**: Workspace-level project graph. Each sub-project has type (app/lib), tags, and build configuration.
- **Key patterns**:
  - `workspace.json` / `nx.json` declares project boundaries
  - Each project has `sourceRoot`, `projectType` (application/library)
  - Implicit dependencies from import graph
  - Generator-based: `@nx/node`, `@nx/react` generators know source structure
  - Build targets define what to include/exclude per project
- **Strengths**: Best mono-repo support, explicit project boundaries
- **Relevant for SA4E-108**: Mono-repo detection with sub-project enumeration

## Patterns to Adopt in BRD/TDD

- [x] **Strategy Pattern**: `ProjectIndexingStrategy` interface with type-specific implementations (JavaMavenStrategy, NodeStrategy, PythonStrategy, etc.)
- [x] **Confidence-based Detection**: Each detector returns score. Highest wins. Handles ambiguous/polyglot repos.
- [x] **Registry Pattern**: `ProjectTypeRegistry` maps build-file signatures to strategy. Extensible (new types added without modifying existing code).
- [x] **Source Root Discovery**: Don't just glob everything — identify actual source directories vs. build output, vendored deps, generated code.
- [x] **Mono-repo Support**: Detect workspace roots (lerna.json, nx.json, pnpm-workspace.yaml) to enumerate sub-projects and apply per-project strategy.
- [x] **Fallback Strategy**: If no project type detected, use current hardcoded DEFAULT_EXCLUDE + DEFAULT_EXTENSIONS (backward compatible).
- [x] **Caching**: Store detected project type in `project_registry` table so re-indexing doesn't re-detect each time.

## Current Architecture Gap (from code review)

**File**: `backend/src/config/index.ts`
- `DEFAULT_EXCLUDE` = hardcoded array for ALL project types
- `DEFAULT_EXTENSIONS` = union of all possible extensions (wastes scan time on irrelevant files)

**File**: `backend/src/engine/indexer/async-file-scanner.ts`
- `scanWorkspaceAsync()` accepts `config.excludePatterns` and `config.includeExtensions`
- These come from `AppConfig` which is loaded once at startup
- **No project-type awareness** — same patterns for Java, Node, Python, Salesforce

**Impact**:
- Java project scans `node_modules/` (doesn't exist but wastes pattern matching)
- Node project doesn't exclude `target/` or `.gradle/` (irrelevant)
- Source roots not prioritized — `src/main/java/` treated same as `src/test/java/`
- No separation of test vs. production code in indexing metadata
