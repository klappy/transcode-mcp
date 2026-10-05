import source from './video-contract.json';
import small from './video-contract-small.json';
export function createVideoCatalog(sources: Array<typeof source>, profiles: {small:typeof small;medium:typeof small}, sourceExtensionRevision:string): {select(url:string,size?:string): typeof source | typeof small | undefined};
