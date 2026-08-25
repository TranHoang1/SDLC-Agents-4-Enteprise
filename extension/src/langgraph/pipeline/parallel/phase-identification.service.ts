export interface PhaseDefinition {
  phase_id: string;
  dependencies: string[];
  can_parallelize: boolean;
}

export interface IPhaseIdentificationService {
  identifyParallelizable(phases: PhaseDefinition[]): PhaseDefinition[];
}

export class PhaseIdentificationService implements IPhaseIdentificationService {
  identifyParallelizable(phases: PhaseDefinition[]): PhaseDefinition[] {
    if (!Array.isArray(phases)) throw new Error('Phases must be an array');
    const ids = new Set<string>();
    for (const p of phases) {
      if (!p || typeof p.phase_id !== 'string' || p.phase_id.trim() === '') {
        throw new Error('Invalid phase definition: phase_id required');
      }
      if (!Array.isArray(p.dependencies)) throw new Error(`Invalid phase definition for ${p.phase_id}`);
      if (typeof p.can_parallelize !== 'boolean') throw new Error(`Invalid phase definition for ${p.phase_id}`);
      ids.add(p.phase_id);
    }
    const result: PhaseDefinition[] = [];
    for (const phase of phases) {
      if (!phase.can_parallelize) continue;
      const unresolved = phase.dependencies.filter(dep => !ids.has(dep));
      if (unresolved.length === 0) result.push(structuredClone(phase));
    }
    return result;
  }
}
