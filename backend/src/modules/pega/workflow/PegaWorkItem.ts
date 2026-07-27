export interface Assignment {
  actor: string;
  deadline?: string;
  assignedAt?: string;
}

export interface WorkItemHistoryEntry {
  shapeId: string;
  shapeType: string;
  action: string;
  result: string;
  timestamp: string;
}

export class PegaWorkItem {
  public currentShapeId: string | null;
  public history: WorkItemHistoryEntry[] = [];
  public assignments: Assignment[] = [];
  public slaData: Record<string, unknown> = {};

  constructor(
    public id: string,
    public state: 'Active' | 'Pending' | 'Resolved' | 'Cancelled' = 'Active',
    currentShapeId?: string,
  ) {
    this.currentShapeId = currentShapeId ?? null;
  }

  addHistory(shapeId: string, shapeType: string, action: string, result: string): void {
    this.history.push({
      shapeId,
      shapeType,
      action,
      result,
      timestamp: new Date().toISOString(),
    });
  }
}
