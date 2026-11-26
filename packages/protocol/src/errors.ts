import { Data, Redacted } from "effect";

export abstract class BaseError<Tag extends string> extends Data.Error<{
  readonly _tag: Tag;
  readonly message: string;
  readonly cause?: Redacted.Redacted<unknown>;
}> {
  protected constructor(
    tag: Tag,
    message: string,
    options?: { readonly cause: unknown },
  ) {
    super(
      options === undefined
        ? { _tag: tag, message }
        : { _tag: tag, message, cause: Redacted.make(options.cause) },
    );
    this.name = tag;
  }
}
