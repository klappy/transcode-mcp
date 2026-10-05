// One closed source×profile catalog consumed by both Worker and container.
// Profiles/settings remain data; this module performs no I/O or encoding.
export function createVideoCatalog(sources, profiles, sourceExtensionRevision) {
    if (!/^[a-f0-9]{40}$/.test(sourceExtensionRevision)) throw Error('Missing source extension revision');
    const rows = sources.flatMap(source => ['xsmall','small','medium','large'].map(size => {
        if (size === 'large') return {url:source.source.url,size,contract:source};
        const profile = profiles[size];
        if (source.source.url === profile.source.url) return {url:source.source.url,size,contract:profile};
        return {url:source.source.url,size,contract:{...structuredClone(profile),source:{...structuredClone(source.source),provenance:{...structuredClone(source.source.provenance),transformation:profile.source.provenance.transformation}},sourceExtensionRevision}};
    }));
    return {select:(url,size='large')=>rows.find(row=>row.url===url&&row.size===size)?.contract};
}
