import { HttpApiGroup } from "effect/http-api";
import { exchangeDeviceCode } from "./ExchangeDeviceCode.ts";
import { requestDeviceCode } from "./RequestDeviceCode.ts";

export const OAuthGroup = HttpApiGroup.make("oauth")
  .add(requestDeviceCode)
  .add(exchangeDeviceCode);
