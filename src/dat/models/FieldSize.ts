export const FIELD_SIZE = {
  BOOL: 1,
  BYTE: 1,
  SHORT: 2,
  LONG: 4,
  LONGLONG: 8,
  STRING: {
    4: 4,
    8: 8,
  } as Record<number, number>,
  KEY: {
    4: 4,
    8: 8,
  } as Record<number, number>,
  KEY_FOREIGN: {
    4: 4 + 4,
    8: 8 + 8,
  } as Record<number, number>,
  ARRAY: {
    4: 4 + 4,
    8: 8 + 8,
  } as Record<number, number>,
};
