export class AgentBudgetError extends Error {
  constructor(
    message: string,
    readonly kind: "qloo" | "nominatim" | "time_soft" | "time_hard",
  ) {
    super(message);
    this.name = "AgentBudgetError";
  }
}

export class AgentBudget {
  qlooCalls = 0;
  nominatimCalls = 0;
  readonly maxQloo = 16;
  readonly maxNominatim = 20;
  readonly softLimitMs = 25_000;
  readonly hardLimitMs = 35_000;
  readonly startedAt = Date.now();

  /** True once past the soft limit; callers should wrap up rather than start new work. */
  pastSoftLimit(): boolean {
    return Date.now() - this.startedAt >= this.softLimitMs;
  }

  checkTime(): void {
    const elapsed = Date.now() - this.startedAt;
    if (elapsed >= this.hardLimitMs) {
      throw new AgentBudgetError("Hard time limit reached", "time_hard");
    }
    // The soft limit only nudges the model to compose (see prepareStep in run-agent).
    // Throwing here killed scout_after_headliner's parallel lookups mid-flight.
  }

  useQloo(): void {
    this.checkTime();
    if (this.qlooCalls >= this.maxQloo) {
      throw new AgentBudgetError("Qloo call budget exhausted", "qloo");
    }
    this.qlooCalls++;
  }

  useNominatim(): void {
    this.checkTime();
    if (this.nominatimCalls >= this.maxNominatim) {
      throw new AgentBudgetError("Nominatim call budget exhausted", "nominatim");
    }
    this.nominatimCalls++;
  }

  elapsedSec(): number {
    return Math.round((Date.now() - this.startedAt) / 1000);
  }
}
