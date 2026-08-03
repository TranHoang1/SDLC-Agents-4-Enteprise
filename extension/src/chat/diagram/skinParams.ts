/**
 * SA4E-85 — PlantUML skin parameters.
 * [TDD-Review-01] Minimal Design Skin: enforces clean rendering
 * in constrained chat viewport. Prepended to all PlantUML source.
 */

/**
 * Default skin parameters for clean, readable diagrams.
 * Orthogonal lines, adequate spacing, hidden empty members.
 */
const SKIN_PARAMS = [
  'skinparam linetype ortho',
  'skinparam nodesep 60',
  'skinparam ranksep 40',
  'hide empty members',
].join('\n');

/**
 * Inject skin parameters into PlantUML source.
 * Inserts after @startuml (or prepends if no @startuml found).
 * @param source - Raw PlantUML source from diagram block
 * @returns Source with skin parameters injected
 */
export function buildSkinnedSource(source: string): string {
  const startTag = '@startuml';
  const startIdx = source.indexOf(startTag);

  if (startIdx === -1) {
    // No @startuml — wrap with tags and skin
    return `@startuml\n${SKIN_PARAMS}\n${source}\n@enduml`;
  }

  // Insert skin params right after @startuml line
  const insertPos = startIdx + startTag.length;
  const afterTag = source.slice(insertPos);
  const beforeTag = source.slice(0, insertPos);

  return `${beforeTag}\n${SKIN_PARAMS}${afterTag}`;
}
