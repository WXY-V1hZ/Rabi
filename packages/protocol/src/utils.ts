import { Schema } from "effect";

const camelToSnake = (key: string) =>
  key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

export function snakeCaseKeys<const Fields extends Schema.Struct.Fields>(
  fields: Fields,
) {
  const mapping = Object.fromEntries(
    Object.keys(fields).map((key) => [key, camelToSnake(key)]),
  ) as {
    [K in keyof Fields]: K extends string ? SnakeCase<K> : K;
  };

  return Schema.Struct(fields).pipe(Schema.encodeKeys(mapping));
}

type SnakeCase<S extends string> = S extends `${infer C}${infer Rest}`
  ? C extends Lowercase<C>
    ? `${C}${SnakeCase<Rest>}`
    : `_${Lowercase<C>}${SnakeCase<Rest>}`
  : S;
