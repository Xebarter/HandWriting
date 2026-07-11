declare module 'opentype.js' {
  export interface FontNames {
    fontFamily?: { en?: string };
    fullName?: { en?: string };
  }

  export interface OpenTypeFont {
    names: FontNames;
  }

  export function parse(input: ArrayBuffer | string | Blob): Promise<OpenTypeFont>;
}
