export interface IBundleLoader {
  fetchFile(filePath: string): Promise<ArrayBuffer>;
}
