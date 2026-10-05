import source from './video-contract.json';
import small from './video-contract-small.json';
export function createVideoCatalog(sources: Array<typeof source>, profiles: {xsmall:typeof small;small:typeof small;medium:typeof small}, sourceExtensionRevision:string, exactRows?:Array<{size:string;contract:typeof source|typeof small}>): {select(url:string,size?:string): typeof source | typeof small | undefined};
