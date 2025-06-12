export class MissingContextError extends Error {
  public code: string = "missing_store_options_error";

  constructor(message?: string) {
    super(message ?? "The context options is missing.");
    this.name = "MissingContextError";
  }
}
