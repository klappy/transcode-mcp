export const VIDEO_SOURCE_ALLOWED_PREFIXES: readonly string[];
export const LAZY_VIDEO_SIZES: readonly string[];
export function isApprovedVideoSource(url: string): boolean;
export type LazyVideoContract = {
  recipe: string;
  source: { url: string; lazy: true; sha256?: undefined; bytes?: undefined; provenance: { transformation: string; assetId?: undefined } };
  limits: { bytes: number; jobMs: number; [key: string]: number };
  encoding: { width: number; height: number; sar: string; dar: string; [key: string]: unknown };
  recipeRevision: string;
  lazySourcePolicy: string;
};
export function createLazyVideoSelect(profiles: Record<'xsmall'|'small'|'medium'|'large'|'xlarge', {source:{provenance:{transformation:string}};limits:object;encoding:object;recipeRevision:string}>): (url: string, size?: string) => LazyVideoContract | undefined;
export function unqualifiedSource(message: string): Error & { status: 422 };
export function fitLazyRaster(profile: {width:number;height:number;sar:string;dar:string}, source: {width:number;height:number;sar?:string}): {width:number;height:number;sar:string;dar:string};
export function validateLazyGeometry(encoding: {width:number;height:number;sar:string;dar:string}): void;
