import { Schema } from "effect";
import { snakeCaseKeys } from "../utils.ts";

const PositiveSeconds = Schema.Int.check(Schema.isGreaterThan(0));

export const AuthResponse = Schema.fromJsonString(
  snakeCaseKeys({
    deviceCode: Schema.RedactedFromValue(Schema.NonEmptyString),
    userCode: Schema.NonEmptyString,
    verificationUri: Schema.URLFromString,
    expiresIn: PositiveSeconds,
    verificationUriComplete: Schema.optionalKey(Schema.URLFromString),
    interval: Schema.optionalKey(PositiveSeconds),
  }),
);

export type AuthResponse = typeof AuthResponse.Type;
