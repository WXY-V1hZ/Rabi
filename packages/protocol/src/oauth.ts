import { Schema } from "effect";
import { snakeCaseKeys } from "./utils.ts";

export const DeviceCodeGrant = "urn:ietf:params:oauth:grant-type:device_code";

export const OAuthErrorBody = snakeCaseKeys({
  error: Schema.NonEmptyString,
  errorDescription: Schema.optionalKey(Schema.String),
  errorUri: Schema.optionalKey(Schema.String),
});
