import axios from "axios";
import { SchemaFile, SCHEMA_URL, SCHEMA_VERSION } from "pathofexile-dat-schema";
import Debug from "debug";

import { Language } from "../models/Language";
import { IBundleLoader } from "../loaders/IBundleLoader";
import { decompressSliceInBundle } from "../bundles/Bundle";
import { getFileInfo, readIndexBundle } from "../bundles/IndexBundle";
import { DatFile, FieldReader, FileReader, Header, HeaderUtils } from "../dat";

export interface ExporterOptions {
  bundleLoader: IBundleLoader;
}

interface BundleIndex {
  bundlesInfo: Uint8Array;
  filesInfo: Uint8Array;
  dirsInfo: Uint8Array;
  pathReps: Uint8Array;
}

interface NamedHeader extends Header {
  name: string;
}

export class DatExporter {
  private readonly _debug: Debug.Debugger;
  private _options: Required<ExporterOptions>;
  private _index: BundleIndex;
  private _schema: SchemaFile;

  constructor(options: ExporterOptions) {
    this._options = options;
    this._debug = Debug(`poe-dat:`).extend(this.constructor.name);
    this._debug("Create instance");
  }

  /**
   * Exports .dat files as table
   *
   * @remarks Unknown columns will be ignored
   *
   * @param fileName The name of the .dat file without the .dat32/64 extension
   * @param language The language
   * @param columns Optional, which columns to export
   * @returns
   */
  async export(
    fileName: string,
    language: Language = Language.English,
    columns?: readonly string[]
  ) {
    this._debug(
      `Start exporting %s in %s with columns %O`,
      fileName,
      language,
      columns
    );

    if (!this._index) await this._loadIndex();
    if (!this._schema) await this._fetchSchema();

    if (this._schema.version != SCHEMA_VERSION) {
      this._debug(
        "Incompatible schema found: %s & %s",
        this._schema.version,
        SCHEMA_VERSION
      );
      throw new Error(
        'Schema has format not compatible with this package. Check for "pathofexile-dat" updates.'
      );
    }

    const filePath = this._getFilePath(fileName, language);
    const datFile = await this._getDatFile(filePath);
    const headers = this._importHeaders(fileName, datFile).filter((hdr) =>
      columns ? columns.includes(hdr.name) : true
    );

    const result = this._exportAllRows(headers, datFile);
    this._debug(`Finished exporting successfully`);

    return result;
  }

  private async _loadIndex(): Promise<void> {
    this._debug(`Loading index bundle`);

    const indexBin = await this._options.bundleLoader.fetchFile("_.index.bin");
    const indexBundle = await decompressSliceInBundle(new Uint8Array(indexBin));
    const _index = readIndexBundle(indexBundle);
    this._index = {
      bundlesInfo: _index.bundlesInfo,
      filesInfo: _index.filesInfo,
      dirsInfo: _index.dirsInfo,
      pathReps: await decompressSliceInBundle(_index.pathRepsBundle),
    };
  }

  /**
   * Fetches the latest Schema describing the .dat files
   */
  private async _fetchSchema(): Promise<void> {
    this._debug(`Fetching latest schema from %s`, SCHEMA_URL);

    const response = await axios({
      url: SCHEMA_URL,
      responseType: "json",
    });

    this._schema = response.data as SchemaFile;
  }

  private async _getDatFile(fullPath: string): Promise<DatFile> {
    this._debug(`Requesting .dat file from path %s`, fullPath);

    const location = getFileInfo(
      fullPath,
      this._index.bundlesInfo,
      this._index.filesInfo
    );

    const bundleBin = await this._options.bundleLoader.fetchFile(
      location.bundle
    );

    const buffer = await decompressSliceInBundle(
      new Uint8Array(bundleBin),
      location.offset,
      location.size
    );
    return FileReader.readDatFile(fullPath, buffer);
  }

  private _importHeaders(name: string, datFile: DatFile): NamedHeader[] {
    const headers = [] as NamedHeader[];

    const schema = this._schema.tables.find((s) => s.name === name);
    if (!schema) {
      this._debug(`Failed to find schema table for ${name}!`);
      throw new Error(`Failed to find schema table for ${name}!`);
    }

    let offset = 0;
    for (const column of schema.columns) {
      headers.push({
        name: column.name || "",
        offset,
        type: {
          array: column.array,
          integer:
            column.type === "i32"
              ? { unsigned: false, size: 4 }
              : column.type === "enumrow"
              ? { unsigned: false, size: 4 }
              : undefined,
          decimal: column.type === "f32" ? { size: 4 } : undefined,
          string: column.type === "string" ? {} : undefined,
          boolean: column.type === "bool" ? {} : undefined,
          key:
            column.type === "row" || column.type === "foreignrow"
              ? {
                  foreign: column.type === "foreignrow",
                }
              : undefined,
        },
      });
      offset += HeaderUtils.getHeaderLength(
        headers[headers.length - 1],
        datFile
      );
    }
    return headers;
  }

  private _exportAllRows(headers: NamedHeader[], datFile: DatFile) {
    // filter out columns without name
    const columns = headers
      .filter((header) => header?.name)
      .map((header) => ({
        name: header.name,
        data: FieldReader.readColumn(header, datFile),
      }));

    columns.unshift({
      name: "_index",
      data: Array(datFile.rowCount)
        .fill(undefined)
        .map((_, idx) => idx),
    });

    return Array(datFile.rowCount)
      .fill(undefined)
      .map((_, idx) =>
        Object.fromEntries(columns.map((col) => [col.name, col.data[idx]]))
      );
  }

  private _getFilePath(fileName: string, language: Language): string {
    const lang = language == Language.English ? "" : `/${language}`;
    return `Data${lang}/${fileName}.dat64`;
  }
}
