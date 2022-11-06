import { describe, it } from "mocha";
import { expect } from "chai";

import { Loaders } from "../src";

describe(`OnlineBundleLoader`, function () {
  const loader = new Loaders.OnlineBundleLoader({
    cacheFile: false,
  });

  it(`fetchFile() - should return index bundle`, async () => {
    const filePath = "_.index.bin";
    await expect(loader.fetchFile(filePath)).to.be.fulfilled;
  });

  it(`fetchFile() - should return German CurrencyItems`, async () => {
    const filePath = "Data/German.dat64.7.bundle.bin";
    await expect(loader.fetchFile(filePath)).to.be.fulfilled;
  });
});
