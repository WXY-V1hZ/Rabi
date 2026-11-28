import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";
import { HttpRouter } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";
import { createServer } from "node:http";
import { RabiApi } from "protocol";
import { AuthHandlers } from "./handlers/auth.ts";
import { OAuthHandlers } from "./handlers/oauth.ts";
import { loadServerEnv } from "./loadEnv.ts";
import { AuthService } from "./services/AuthService.ts";
import { ExecutorRegistration } from "./services/ExecutorRegistration.ts";
import { OAuthService } from "./services/OAuthService.ts";
import { DeviceHandlers } from "./handlers/device.ts";

loadServerEnv();

const handlers = Layer.mergeAll(
  HttpApiBuilder.layer(RabiApi).pipe(
    Layer.provide(Layer.mergeAll(OAuthHandlers, DeviceHandlers)),
  ),
  AuthHandlers,
).pipe(
  Layer.provide(
    Layer.mergeAll(
      AuthService.layer,
      OAuthService.layer.pipe(Layer.provide(ExecutorRegistration.layer)),
    ),
  ),
);

const server = HttpRouter.serve(handlers).pipe(
  Layer.provide(
    NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 3000 }),
  ),
);

Layer.launch(server).pipe(NodeRuntime.runMain);
