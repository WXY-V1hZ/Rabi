import { HttpApi } from "effect/http-api";
import { OAuthGroup } from "./oauth/index.ts";
import { DeviceGroup } from "./device/index.ts";

export const RabiApi = HttpApi.make("rabi").add(OAuthGroup).add(DeviceGroup);
