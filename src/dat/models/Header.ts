export interface Header {
  offset: number;
  type: {
    array?: boolean;
    boolean?: {};
    integer?: { unsigned: boolean; size: number };
    decimal?: { size: number };
    string?: {};
    key?: { foreign: boolean };
  };
}
