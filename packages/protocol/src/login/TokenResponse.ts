import { Schema } from "effect";
import { snakeCaseKeys } from "../utils.ts";

const PositiveSeconds = Schema.Int.check(Schema.isGreaterThan(0));

export const TokenResponse = Schema.fromJsonString(
  snakeCaseKeys({
    accessToken: Schema.RedactedFromValue(Schema.NonEmptyString),
    tokenType: Schema.String.check(Schema.isPattern(/^Bearer$/i)),
    expiresIn: PositiveSeconds,
    executorId: Schema.NonEmptyString,
    scope: Schema.optionalKey(Schema.String),
  }),
);

export type TokenResponse = typeof TokenResponse.Type;
