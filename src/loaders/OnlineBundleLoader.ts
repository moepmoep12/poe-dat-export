import ExpiryMap from "expiry-map";
import * as fs from "fs";
import * as path from "path";
import axios, { AxiosResponseHeaders } from "axios";
import { Http2Stream } from "http2";
import Debug from "debug";

import type { Optional } from "../utils/types/Typings";
import { getLatestPoEPatch } from "../utils/functions/latestPatchVersion";

import { IBundleLoader } from "./IBundleLoader";

export interface OnlineBundleLoaderOptions {
  /**
   * The duration in ms determining how long an item
   * will stay in in-memory cache
   */
  cacheDuration?: number;

  /**
   * The patch version. If not specified, the latest
   * will be used.
   */
  patchVersion?: string;

  /**
   * The endpoint to use for fetching the files.
   */
  endpoint?: URL;

  /**
   * Whether once downloaded bundles will be cached as files.
   * Default: true.
   */
  cacheFile?: boolean;

  /**
   * The absolute path to a cache folder where files will be cached.
   *
   * @remarks The folder will be created if it not exists
   * @remarks Only used when `cacheFile` is true
   */
  cacheDir?: string;
}

interface DownloadState {
  totalSize: number;
  received: number;
  bundleName: string;
  isDownloading: boolean;
}

/**
 * Loads bundles from the content.ggpk from the web
 */
export class OnlineBundleLoader implements IBundleLoader {
  private readonly _weakCache: ExpiryMap<string, ArrayBuffer>;
  /**
   * To turn on debug information for this entity, add `Loader:*`
   * to the `DEBUG` environment variable
   */
  private readonly _debug: Debug.Debugger;
  private _options: Required<OnlineBundleLoaderOptions>;

  private _state: DownloadState;

  constructor(options: OnlineBundleLoaderOptions) {
    this._debug = Debug(`poe-dat:`).extend(this.constructor.name);
    this._options = this._optionsWithDefaults(options);

    this._weakCache = new ExpiryMap(this._options.cacheDuration);

    this._state = {
      bundleName: "",
      isDownloading: false,
      received: 0,
      totalSize: 0,
    };
    this._debug("Create instance with options %o", options);
  }

  get Options(): Readonly<Required<OnlineBundleLoaderOptions>> {
    return this._options;
  }

  updateOptions(options: Partial<OnlineBundleLoaderOptions>) {
    this._debug("Updating options with %o", options);
    this._options = Object.assign(this._options, options);
  }

  async fetchFile(filePath: string): Promise<ArrayBuffer> {
    this._debug(`Fetching file %s`, filePath);

    if (!this._options.patchVersion)
      this._options.patchVersion = await getLatestPoEPatch();

    let bundle = this._fetchFromCache(filePath);
    if (bundle && bundle.byteLength != 0) {
      return Promise.resolve(bundle);
    }

    // download
    bundle = await this._fetchFile(filePath);
    this._cache(filePath, bundle);
    return bundle;
  }

  private _optionsWithDefaults(
    options: OnlineBundleLoaderOptions
  ): Required<OnlineBundleLoaderOptions> {
    const optionalDefaults: Required<Optional<OnlineBundleLoaderOptions>> = {
      cacheDuration: 1000 * 60,
      endpoint: new URL("https://poe-bundles.snos.workers.dev/"),
      patchVersion: "",
      cacheFile: true,
      cacheDir: path.join(__dirname, "../.cache"),
    };
    if (!options.cacheDir) delete options.cacheDir;
    return Object.assign(optionalDefaults, options);
  }

  private buildUrl(fileName: string): URL {
    return new URL(
      `${this._options.endpoint.toString()}/${
        this._options.patchVersion
      }/Bundles2/${fileName}`
    );
  }

  private async _fetchFile(name: string): Promise<ArrayBuffer> {
    try {
      const url = this.buildUrl(name);

      this._debug(`Downloading file %s from URL %s`, name, url.toString());

      this._state.received = 0;
      this._state.totalSize = 0;
      this._state.isDownloading = true;
      this._state.bundleName = name;

      const res = await axios({
        url: url.toString(),
        responseType: "stream",
      });

      this._state.totalSize = parseInt(
        ((res.headers as AxiosResponseHeaders).getContentLength() as string) ||
          res.headers["content-cength"] ||
          "1"
      );

      const chunks = [] as Uint8Array[];

      const buffer: Promise<Uint8Array> = new Promise((resolve, reject) => {
        const stream = res.data as Http2Stream;

        stream.on("data", (data) => {
          this._state.received += data.length;
          chunks.push(new Uint8Array(data as Buffer));
        });

        stream.on("end", () => {
          const buf = new Uint8Array(this._state.received);
          let bufPos = 0;
          for (const chunk of chunks) {
            buf.set(chunk, bufPos);
            bufPos += chunk.length;
          }
          this._debug(
            `Download finished for file %s from URL %s`,
            name,
            url.toString()
          );
          resolve(buf);
        });

        stream.on("error", (err) => {
          this._debug(
            `Error while downloading file %s from URL %s : %s`,
            name,
            url?.toString(),
            err
          );
          reject(err);
        });
      });

      await buffer;
      return buffer;
    } finally {
      this._state.isDownloading = false;
    }
  }

  private _cache(filePath: string, bundle: ArrayBuffer) {
    this._debug(`Caching file %s in-memory`, filePath);

    this._weakCache.set(filePath, bundle);

    if (!this._options.cacheFile) return;

    const cacheDir = path.join(
      this.Options.cacheDir,
      this.Options.patchVersion
    );
    if (!fs.existsSync(cacheDir)) {
      this._debug(`Creating cache dir %s`, cacheDir);
      fs.rmSync(this.Options.cacheDir, {
        recursive: true,
        force: true,
      });
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const cachedFilePath = path.join(cacheDir, filePath.replace(/\//g, "@"));
    this._debug(`Saving file %s to disk at %s`, filePath, cachedFilePath);
    fs.writeFileSync(cachedFilePath, Buffer.from(bundle));
  }

  private _fetchFromCache(filePath: string): ArrayBuffer | undefined {
    let result = this._weakCache.get(filePath);
    if (result && result.byteLength != 0) {
      this._debug(`Fetched file %s from in-memory cache`, filePath);
      this._weakCache.set(filePath, result);
      return result;
    }

    result = this._tryLoadFromFile(filePath);
    if (result && result.byteLength != 0) {
      this._debug(`Fetched file %s from file cache`, filePath);
      this._weakCache.set(filePath, result); // refresh ttl
      return result;
    }
  }

  private _tryLoadFromFile(filePath: string): ArrayBuffer | undefined {
    const cacheDir = path.join(
      this.Options.cacheDir,
      this.Options.patchVersion
    );
    const cachedFilePath = path.join(cacheDir, filePath.replace(/\//g, "@"));

    if (fs.existsSync(cachedFilePath)) {
      const bundleBin = fs.readFileSync(cachedFilePath);
      return bundleBin;
    }
  }
}
