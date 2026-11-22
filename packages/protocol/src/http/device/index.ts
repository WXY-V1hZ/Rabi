import { HttpApiGroup } from "effect/http-api";
import { denyDeviceAuthorization } from "./DenyDeviceAuthorization.ts";

export const DeviceGroup = HttpApiGroup.make("device").add(
  denyDeviceAuthorization,
);
