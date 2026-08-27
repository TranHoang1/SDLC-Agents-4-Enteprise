/**
 * SA4E — Unit tests for PegaCaseTypeExtractor.
 * Verifies a case type's real lifecycle (stages → processes, primary + alternate)
 * is reconstructed from pyStages/pyAlternateStages, mirroring the Pega Case
 * Lifecycle UI, instead of only case metadata.
 */

import { describe, it, expect } from 'vitest';
import { extractCaseTypeLifecycle } from '../PegaCaseTypeExtractor.js';

const CASE = {
  pxObjClass: 'Rule-Obj-CaseType',
  pyLabel: 'Candidate',
  pyStages: [
    {
      pyStageName: 'Submission', pyStageID: 'PRIM1',
      pyIsInitializationStage: 'true', pyStageTransition: 'automatic',
      pyProcesses: [
        { pyLabel: 'Collect Candidate Details', pyFlowName: 'CollectCandidateDetails_0', pyStartType: 'PARALLEL', pyStartWhen: 'Always' },
      ],
    },
    {
      pyStageName: 'Offer', pyStageID: 'PRIM5',
      pyIsTerminalStage: 'true', pyStageTransition: 'resolution', pyStageWorkStatus: 'Resolved-Completed',
      pyProcesses: [
        { pyLabel: 'Prepare Offer', pyFlowName: 'PrepareOffer_0', pyStartType: 'PARALLEL' },
        { pyLabel: 'Accept Offer', pyFlowName: 'AcceptOffer_0', pyStartType: 'SEQUENTIAL' },
      ],
    },
  ],
  pyAlternateStages: [
    {
      pyStageName: 'Candidate Rejection', pyStageID: 'ALT1',
      pyIsTerminalStage: 'true', pyStageTransition: 'resolution', pyStageWorkStatus: 'Resolved-Rejected',
      pyProcesses: [{ pyLabel: 'Notify Candidate', pyFlowName: 'NotifyCandidate_0', pyStartType: 'PARALLEL' }],
    },
  ],
};

describe('PegaCaseTypeExtractor', () => {
  it('renders primary stages with their processes and flow links', () => {
    const out = extractCaseTypeLifecycle(CASE)!;
    expect(out).toContain('LOGIC (Case Lifecycle):');
    expect(out).toContain('CASE: Candidate');
    expect(out).toContain('Stage: Submission [initial, automatic]');
    expect(out).toContain('- Collect Candidate Details (flow=CollectCandidateDetails_0) [PARALLEL]');
    expect(out).toContain('Stage: Offer [terminal, resolution, status=Resolved-Completed]');
    expect(out).toContain('- Accept Offer (flow=AcceptOffer_0) [SEQUENTIAL]');
  });

  it('renders alternate stages separately', () => {
    const out = extractCaseTypeLifecycle(CASE)!;
    expect(out).toContain('ALTERNATE STAGES:');
    expect(out).toContain('Alt Stage: Candidate Rejection [terminal, resolution, status=Resolved-Rejected]');
    expect(out).toContain('- Notify Candidate (flow=NotifyCandidate_0) [PARALLEL]');
  });

  it('shows a conditional start-when guard when not Always', () => {
    const out = extractCaseTypeLifecycle({
      pyStages: [{ pyStageName: 'S', pyProcesses: [{ pyLabel: 'P', pyFlowName: 'F', pyStartWhen: 'IsUrgent' }] }],
    })!;
    expect(out).toContain('when IsUrgent');
  });

  it('returns null when there are no stages (metadata-only export)', () => {
    expect(extractCaseTypeLifecycle({ pxObjClass: 'Rule-Obj-CaseType', pyLabel: 'X' })).toBeNull();
  });
});
