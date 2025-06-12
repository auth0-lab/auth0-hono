import { HTTPException } from "hono/http-exception";
import { ContentfulStatusCode } from "hono/utils/http-status";

export class Auth0Exception extends HTTPException {
  constructor(
    error: string,
    errorDescription: string,
    status: ContentfulStatusCode | number = 400,
    cause: unknown = null,
  ) {
    const res = new Response(
      JSON.stringify({
        error,
        error_description: errorDescription,
      }),
      {
        status: status,
        headers: { "Content-Type": "application/json" },
      },
    );

    super(status as ContentfulStatusCode, {
      message: errorDescription,
      res,
      cause,
    });
  }
}
