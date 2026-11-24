import { HttpApiGroup } from "effect/http-api";
import { denyDeviceAuthorization } from "./DenyDeviceAuthorization.ts";
import { approveDeviceAuthorization } from "./ApproveDeviceAuthorization.ts";

export const DeviceGroup = HttpApiGroup.make("device").add(
  denyDeviceAuthorization,
  approveDeviceAuthorization,
);
