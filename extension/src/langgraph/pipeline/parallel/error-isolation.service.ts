export interface BranchError {
  branch_id: string;
  error_code?: string;
  error_message?: string;
}

export interface IErrorIsolationPolicy {
  shouldContinue(failures: BranchError[]): boolean;
}

export class AllSuccessPolicy implements IErrorIsolationPolicy {
  shouldContinue(failures: BranchError[]): boolean { return failures.length === 0; }
}
export class ContinueOnErrorPolicy implements IErrorIsolationPolicy {
  shouldContinue(_failures: BranchError[]): boolean { return true; }
}
export class MajoritySuccessPolicy implements IErrorIsolationPolicy {
  constructor(private totalBranches: number) {}
  shouldContinue(failures: BranchError[]): boolean {
    const success = this.totalBranches - failures.length;
    return success > this.totalBranches / 2;
  }
}

export class ErrorIsolationService {
  private static readonly MAX_ERROR_MESSAGE_LENGTH = 500;
  private sanitizeMessage(msg: string): string {
    const cleaned = msg.replace(/[\r\n]+/g, ' ').trim();
    return cleaned.slice(0, ErrorIsolationService.MAX_ERROR_MESSAGE_LENGTH);
  }
  capture(branchId: string, error: Error): BranchError {
    return { branch_id: branchId, error_code: 'ERR_BRANCH', error_message: this.sanitizeMessage(error.message ?? 'Unknown error') };
  }
}
