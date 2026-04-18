export interface FrontierCandidate {
  readonly nodeId: string;
  readonly scopeId: string;
  readonly utility: number;
  readonly localEntropy: number;
  readonly validationPressure: number;
  readonly depth: number;
}

export interface FrontierSelection {
  readonly nodeId: string;
  readonly scopeId: string;
  readonly utility: number;
  readonly localEntropy: number;
  readonly validationPressure: number;
  readonly probability: number;
  readonly rank: number;
  readonly depthClamp: number;
}

export interface FrontierSnapshot {
  readonly id: string;
  readonly sessionId: string;
  readonly scopeId: string;
  readonly temperature: number;
  readonly globalEntropy: number;
  readonly depthClamp: number;
  readonly selections: readonly FrontierSelection[];
  readonly createdAt: string;
}
