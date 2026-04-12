declare module "uuid" {
  export function v4(): string;
}

declare module "file-saver" {
  export function saveAs(
    data: Blob | File | string,
    filename?: string,
    options?: FileSaverOptions
  ): void;
  interface FileSaverOptions {
    autoBom?: boolean;
  }
}
