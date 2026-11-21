import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { Effect } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

const auth = betterAuth({
  baseURL: "http://127.0.0.1:3000",
  database: memoryAdapter({
    user: [],
    account: [],
    session: [],
    verification: [],
  }),
  emailAndPassword: { enabled: true },
});

export const AuthRoutes = HttpRouter.add("*", "/api/auth/*", (request) =>
  Effect.gen(function* () {
    const webRequest = yield* HttpServerRequest.toWeb(request);
    const response = yield* Effect.tryPromise(() => auth.handler(webRequest));
    return HttpServerResponse.fromWeb(response);
  }),
);
