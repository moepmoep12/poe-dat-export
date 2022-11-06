import { findSequence } from "../utils/functions/findSequence";
import { fnv1a64 } from "../utils/functions/fnv1a64";

const S_HASH = 8;
const S_HASH$ = 0;
const S_OFFSET = 4;
const S_OFFSET$ = S_HASH$ + S_HASH;
const S_DIRECT_SIZE = 4;
const S_DIRECT_SIZE$ = S_OFFSET$ + S_OFFSET;
const S_ALL_SIZE = 4;
const S_ALL_SIZE$ = S_DIRECT_SIZE$ + S_DIRECT_SIZE;
const STRUCT_SIZE = S_HASH + S_OFFSET + S_DIRECT_SIZE + S_ALL_SIZE;

const REP_INDEX = 4;
const SLASH_CHAR = "/".charCodeAt(0);

const UTF8_DECODER = new TextDecoder("utf-8");

export function getRootDirs(pathReps: Uint8Array, dirsInfo: Uint8Array) {
  const pathsReader = new DataView(
    pathReps.buffer,
    pathReps.byteOffset,
    pathReps.byteLength
  );
  const dirsReader = new DataView(
    dirsInfo.buffer,
    dirsInfo.byteOffset,
    dirsInfo.byteLength
  );
  const dirsCount = dirsInfo.byteLength / STRUCT_SIZE;

  const rootDirs = new Set<string>();
  for (let idx = 0; idx < dirsCount; ++idx) {
    let pathsOffset = dirsReader.getInt32(STRUCT_SIZE * idx + S_OFFSET$, true);

    // consume `BASE_MODE ON`
    pathsOffset += REP_INDEX;

    // check if `BASE_MODE OFF` follows immediately
    const hasNoFiles = pathsReader.getInt32(pathsOffset, true) === 0;
    if (!hasNoFiles) {
      pathsOffset += REP_INDEX;
      const firstSlashIdx = pathReps.indexOf(SLASH_CHAR, pathsOffset);
      const rootDir = UTF8_DECODER.decode(
        pathReps.subarray(pathsOffset, firstSlashIdx)
      );
      rootDirs.add(rootDir);
    }
  }

  return Array.from(rootDirs);
}

export function getDirContent(
  dirPath: string,
  pathReps: Uint8Array,
  dirsInfo: Uint8Array
) {
  const pathsReader = new DataView(
    pathReps.buffer,
    pathReps.byteOffset,
    pathReps.byteLength
  );
  const dirsReader = new DataView(
    dirsInfo.buffer,
    dirsInfo.byteOffset,
    dirsInfo.byteLength
  );
  const dirsCount = dirsInfo.byteLength / STRUCT_SIZE;

  let childrenStart: number;
  let childrenEnd: number;
  let files: string[];
  {
    const hash = fnv1a64(dirPath + "++");

    const structOffset = findSequence(dirsInfo, hash);
    if (structOffset === -1) {
      throw new Error("never");
    }

    const offset = dirsReader.getInt32(structOffset + S_OFFSET$, true);
    const size = dirsReader.getInt32(structOffset + S_DIRECT_SIZE$, true);

    files = unpackPaths(pathReps.subarray(offset, offset + size));

    childrenStart = offset + size;
    childrenEnd =
      offset + dirsReader.getInt32(structOffset + S_ALL_SIZE$, true);
  }

  // Art dir is special
  if (dirPath === "Art") {
    const dirs = getChildDirectories("Art", pathReps, dirsInfo);
    return { files, dirs };
  }

  const dirs = new Set<string>();
  for (let idx = 0; idx < dirsCount; ++idx) {
    let offset = dirsReader.getInt32(STRUCT_SIZE * idx + S_OFFSET$, true);
    const size = dirsReader.getInt32(STRUCT_SIZE * idx + S_DIRECT_SIZE$, true);

    if (offset < childrenStart || offset + size > childrenEnd) {
      continue;
    }

    // consume `BASE_MODE ON`
    offset += REP_INDEX;
    // check if `BASE_MODE OFF` follows immediately
    const hasNoFiles = pathsReader.getInt32(offset, true) === 0;
    if (hasNoFiles) continue;

    offset += REP_INDEX;
    const nullChar = pathReps.indexOf(0x00, offset);
    const basepath = UTF8_DECODER.decode(pathReps.subarray(offset, nullChar));
    if (!basepath.startsWith(dirPath)) {
      throw new Error("never");
    }
    const slashIdx = basepath.indexOf("/", dirPath.length + 1);
    dirs.add(basepath.slice(0, slashIdx));
  }

  return { files, dirs: Array.from(dirs) };
}

export function unpackPaths(data: Uint8Array) {
  const reader = new DataView(data.buffer, data.byteOffset, data.byteLength);

  let offset = 0;
  let baseMode = false;
  let bases = [] as string[];
  const paths = [] as string[];

  while (offset <= data.byteLength - REP_INDEX) {
    const idx = reader.getInt32(offset, true) - 1;
    offset += REP_INDEX;

    if (idx === -1) {
      baseMode = !baseMode;
      if (baseMode) {
        bases = [];
      }
    } else {
      const nullChar = data.indexOf(0x00, offset);
      let path = UTF8_DECODER.decode(data.subarray(offset, nullChar));
      offset = nullChar + 1;

      if (idx < bases.length) {
        path = `${bases[idx]}${path}`;
      }

      if (baseMode) {
        bases.push(path);
      } else {
        paths.push(path);
      }
    }
  }

  return paths;
}

function getChildDirectories(
  dirPath: string,
  pathReps: Uint8Array,
  dirsInfo: Uint8Array
) {
  const pathsReader = new DataView(
    pathReps.buffer,
    pathReps.byteOffset,
    pathReps.byteLength
  );
  const dirsReader = new DataView(
    dirsInfo.buffer,
    dirsInfo.byteOffset,
    dirsInfo.byteLength
  );
  const dirsCount = dirsInfo.byteLength / STRUCT_SIZE;

  const dirs = new Set<string>();
  for (let idx = 0; idx < dirsCount; ++idx) {
    let pathsOffset = dirsReader.getInt32(STRUCT_SIZE * idx + S_OFFSET$, true);

    // consume `BASE_MODE ON`
    pathsOffset += REP_INDEX;

    // check if `BASE_MODE OFF` follows immediately
    const hasNoFiles = pathsReader.getInt32(pathsOffset, true) === 0;
    if (!hasNoFiles) {
      pathsOffset += REP_INDEX;

      const nullChar = pathReps.indexOf(0x00, pathsOffset);
      const basepath = UTF8_DECODER.decode(
        pathReps.subarray(pathsOffset, nullChar)
      );

      if (basepath.startsWith(dirPath + "/") && basepath !== dirPath + "/") {
        const slashIdx = basepath.indexOf("/", dirPath.length + 1);
        dirs.add(basepath.slice(0, slashIdx));
      }
    }
  }

  return Array.from(dirs);
}
