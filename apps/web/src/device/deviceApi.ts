import { Effect, Schema } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import { HttpApiClient } from "effect/http-api";
import { RabiApi } from "protocol";

export function submitDeviceDecision(
  action: "approve" | "deny",
  userCode: string,
) {
  const submit = Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient;
    const device = yield* HttpApiClient.group(RabiApi, {
      group: "device",
      httpClient,
      baseUrl: window.location.origin,
    });

    const request = {
      payload: { userCode: userCode.trim().toUpperCase() },
      responseMode: "response-only",
    } as const;

    return yield* action === "approve"
      ? device.approveDeviceAuthorization(request)
      : device.denyDeviceAuthorization(request);
  });

  return Effect.runPromise(
    submit.pipe(
      Effect.provide(FetchHttpClient.layer),
      Effect.match({
        onFailure: (error) =>
          Schema.isSchemaError(error) ? "invalid-code" : "unavailable",
        onSuccess: ({ status }) => {
          switch (status) {
            case 204:
              return "recorded";
            case 401:
              return "signed-out";
            case 403:
              return "forbidden";
            case 404:
              return "not-found";
            case 409:
              return "already-decided";
            default:
              return "unavailable";
          }
        },
      }),
    ),
  );
}
