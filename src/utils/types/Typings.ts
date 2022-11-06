/**
 * Get all optional keys in T (non-array types only).
 *
 * @category Common
 */
export type OptionalKeys<T> = {
  [K in keyof T]-?: Record<string, unknown> extends Pick<T, K> ? K : never;
}[keyof T];

/**
 * From T, pick all optional properties.
 *
 * @category Common
 */
export type Optional<T> = Pick<T, OptionalKeys<T>>;
