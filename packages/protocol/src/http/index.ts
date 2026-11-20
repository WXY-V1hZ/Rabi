import { HttpApi } from "effect/http-api";
import { LoginGroup } from "./login/index.ts";

export const RabiApi = HttpApi.make("rabi").add(LoginGroup);
