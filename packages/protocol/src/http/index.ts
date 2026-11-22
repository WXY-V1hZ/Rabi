import { HttpApi } from "effect/http-api";
import { OAuthGroup } from "./oauth/index.ts";

export const RabiApi = HttpApi.make("rabi").add(OAuthGroup);
