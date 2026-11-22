import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";
import { HttpRouter } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";
import { createServer } from "node:http";
import { RabiApi } from "protocol";
import { AuthRoutes } from "./routes/auth.ts";
import { OAuthHandlers } from "./routes/oauth.ts";

const routes = Layer.mergeAll(
  HttpApiBuilder.layer(RabiApi).pipe(Layer.provide(OAuthHandlers)),
  AuthRoutes,
);

const server = HttpRouter.serve(routes).pipe(
  Layer.provide(
    NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 3000 }),
  ),
);

Layer.launch(server).pipe(NodeRuntime.runMain);
