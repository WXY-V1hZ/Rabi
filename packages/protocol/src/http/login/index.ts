import { HttpApiGroup } from "effect/http-api";
import { exchangeDeviceCode } from "./ExchangeDeviceCode.ts";
import { requestDeviceCode } from "./RequestDeviceCode.ts";

export const LoginGroup = HttpApiGroup.make("login")
  .add(requestDeviceCode)
  .add(exchangeDeviceCode);
