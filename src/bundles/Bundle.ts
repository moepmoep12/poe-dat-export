import * as Ooz from "ooz-wasm";

// https://github.com/poe-tool-dev/ggpk.discussion/wiki/Bundle-scheme#bundle-file-format
const S_DECOMPRESSED_DATA_SIZE$ = 0;
const S_CHUNK_COUNT$ = 36;
const S_COMPRESSION_GRANULARITY$ = 40;
const S_CHUNK_SIZES$ = 60;

export async function decompressSliceInBundle(
  bundle: Uint8Array,
  sliceOffset = 0,
  sliceSize = 0
): Promise<Uint8Array> {
  const reader = new DataView(
    bundle.buffer,
    bundle.byteOffset,
    bundle.byteLength
  );
  const decompressedBundleSize = reader.getInt32(
    S_DECOMPRESSED_DATA_SIZE$,
    true
  );
  const chunksCount = reader.getInt32(S_CHUNK_COUNT$, true);
  const compressionGranularity = reader.getInt32(
    S_COMPRESSION_GRANULARITY$,
    true
  );

  if (!sliceSize) {
    sliceSize = decompressedBundleSize;
  }

  const decompressedSlice = new Uint8Array(sliceSize);

  let chunkBegin = S_CHUNK_SIZES$ + chunksCount * 4;
  let bundleDecomprOffset = 0;
  let sliceDecomprOffset = 0;
  for (let idx = 0; idx < chunksCount; idx += 1) {
    const chunkSize = reader.getInt32(S_CHUNK_SIZES$ + idx * 4, true);
    const chunk = bundle.subarray(chunkBegin, chunkBegin + chunkSize);

    const decomprChunkSize =
      idx === chunksCount - 1
        ? decompressedBundleSize % compressionGranularity
        : compressionGranularity;

    if (
      Math.max(bundleDecomprOffset, sliceOffset) <
      Math.min(bundleDecomprOffset + decomprChunkSize, sliceOffset + sliceSize)
    ) {
      const begin = Math.max(sliceOffset - bundleDecomprOffset, 0);
      const end = Math.min(
        sliceOffset + sliceSize - bundleDecomprOffset,
        decomprChunkSize
      );

      const raw = await Ooz.decompressUnsafe(chunk, decomprChunkSize);
      decompressedSlice.set(raw.subarray(begin, end), sliceDecomprOffset);

      sliceDecomprOffset += end - begin;
    }

    bundleDecomprOffset += decomprChunkSize;
    chunkBegin += chunkSize;
  }

  return decompressedSlice;
}
