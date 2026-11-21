import { Command } from "effect/cli";
import { Effect, Layer } from "effect";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { login } from "./cli/login.ts";
import { makeLoginLayer } from "./service/LoginService.ts";
import { FetchHttpClient } from "effect/http";

const loginLayer = makeLoginLayer(
  new URL("http://127.0.0.1:3000"),
  "rabi-cli",
).pipe(Layer.provide(FetchHttpClient.layer));

const mainLayer = Layer.mergeAll(NodeServices.layer, loginLayer);

const rabi = Command.make("rabi").pipe(
  Command.withDescription("Rabi 本地执行器"),
  Command.withSubcommands([login]),
);

const main = Command.run(rabi, {
  version: "0.1.0",
}).pipe(Effect.provide(mainLayer));

NodeRuntime.runMain(main);
