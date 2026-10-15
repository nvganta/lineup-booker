export function getQlooConfig(): {
  apiKey: string | undefined;
  baseUrl: string;
} {
  const baseUrl =
    process.env.QLOO_API_BASE?.replace(/\/$/, "") ??
    "https://hackathon.api.qloo.com";
  return {
    apiKey: process.env.QLOO_API_KEY,
    baseUrl,
  };
}

export class QlooConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QlooConfigError";
  }
}

export class QlooApiError extends Error {
  readonly status: number;
  readonly retryable: boolean;

  constructor(message: string, status: number, retryable = false) {
    super(message);
    this.name = "QlooApiError";
    this.status = status;
    this.retryable = retryable;
  }
}
