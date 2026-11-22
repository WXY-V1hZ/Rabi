import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { AuthService } from "../services/AuthService.ts";

export const AuthHandlers = Layer.unwrap(
  Effect.gen(function* () {
    const auth = yield* AuthService;
    return HttpRouter.add("*", "/api/auth/*", (request) =>
      Effect.gen(function* () {
        const webRequest = yield* HttpServerRequest.toWeb(request);
        const response = yield* auth.handle(webRequest);
        return HttpServerResponse.fromWeb(response);
      }),
    );
  }),
);
