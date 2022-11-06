export interface Header {
  offset: number;
  type: {
    array?: boolean;
    boolean?: unknown;
    integer?: { unsigned: boolean; size: number };
    decimal?: { size: number };
    string?: unknown;
    key?: { foreign: boolean };
  };
}
