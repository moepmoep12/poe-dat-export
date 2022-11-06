import { BinaryReader } from "../../utils/classes/BinaryReader";

import { FIELD_SIZE } from "./FieldSize";

export interface DatFile {
  memsize: number;
  rowCount: number;
  rowLength: number;
  dataFixed: Uint8Array;
  dataVariable: Uint8Array;
  readerFixed: BinaryReader;
  readerVariable: BinaryReader;
  fieldSize: Record<keyof typeof FIELD_SIZE, number>;
}
