import { Command } from "effect/cli";
import { Effect, Layer } from "effect";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { login } from "./cli/login.ts";
import { makeLoginLayer } from "./service/LoginService.ts";
import { HttpClient, HttpClientResponse } from "effect/http";

const rabi = Command.make("rabi").pipe(
  Command.withDescription("Rabi 本地执行器"),
  Command.withSubcommands([login]),
);

const authFixture = {
  device_code: "test-device-code",
  user_code: "RABI-1234",
  verification_uri: "https://rabi.example.test/device",
  expires_in: 600,
  interval: 1,
};

const tokenFixture = {
  access_token: "test-access-token",
  token_type: "Bearer",
  expires_in: 3600,
  executor_id: "executor-test",
};

let tokenPolls = 0;
const mockHttpLayer = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make((request, url) => {
    if (request.method !== "POST") {
      return Effect.die(
        new Error(`收到非预期请求：${request.method} ${url.pathname}`),
      );
    }
    if (url.pathname === "/oauth/device/code") {
      return Effect.succeed(
        HttpClientResponse.fromWeb(request, Response.json(authFixture)),
      );
    } else if (url.pathname === "/oauth/token") {
      const error = ["authorization_pending", "slow_down"][tokenPolls++];
      const response =
        error === undefined
          ? Response.json(tokenFixture)
          : Response.json({ error }, { status: 400 });
      return Effect.succeed(HttpClientResponse.fromWeb(request, response));
    }
    return Effect.die(
      new Error(`收到非预期请求：${request.method} ${url.pathname}`),
    );
  }),
);

const demoLoginLayer = makeLoginLayer(
  new URL("https://test.rabi.com"),
  "rabi-cli",
).pipe(Layer.provide(mockHttpLayer));

const mainLayer = Layer.mergeAll(NodeServices.layer, demoLoginLayer);

const main = Command.run(rabi, {
  version: "0.1.0",
}).pipe(Effect.provide(mainLayer));

NodeRuntime.runMain(main);
