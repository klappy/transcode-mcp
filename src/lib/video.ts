import {createHash} from "node:crypto";
import contract from '../../container/video-contract.json';
export { contract as videoContract };
export function videoOptions(raw: Record<string, string>) { for (const [k, v] of Object.entries(raw))
    if (!({ preset: 'fia', q: 'medium', f: 'mp4' } as Record<string, string>)[k] || ({ preset: 'fia', q: 'medium', f: 'mp4' } as Record<string, string>)[k] !== v)
        throw Error('Unsupported video option'); return { preset: 'fia', q: 'medium', f: 'mp4' } as const; }
export async function videoKey(encoderRevision: string) { if (!/^[a-f0-9]{64}$/.test(encoderRevision))
    throw Error('Invalid encoder revision'); return 'video-v1/' + Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ contract, encoderRevision })))), x => x.toString(16).padStart(2, '0')).join('') + '.mp4'; }
export function byteRange(value: string | null, size: number): {
    offset: number;
    length: number;
} | null {
    if (value === null)
        return null;
    const m = /^bytes=(\d*)-(\d*)$/.exec(value);
    if (!m || (!m[1] && !m[2]))
        throw Error('Invalid range');
    let start, end;
    if (!m[1]) {
        const suffix = Number(m[2]);
        if (!Number.isSafeInteger(suffix) || suffix <= 0)
            throw Error('Invalid range');
        start = Math.max(0, size - suffix);
        end = size - 1;
    }
    else {
        start = Number(m[1]);
        end = m[2] ? Number(m[2]) : size - 1;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start)
            throw Error('Invalid range');
        end = Math.min(end, size - 1);
    }
    return { offset: start, length: end - start + 1 };
}
export async function handleVideoProxy(request: Request, bucket: R2Bucket | undefined, instance: () => Promise<{
    fetch: (r: Request) => Promise<Response>;
}>, source: string, options: Record<string, string>): Promise<Response> {
    const headers = new Headers({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, ETag, X-Transcode-Cache, X-Transcode-Encode', 'Accept-Ranges': 'bytes' });
    const fail = (status: number, message: string) => new Response(message, { status, headers });
    if (request.method === 'OPTIONS') {
        headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Range');
        return new Response(null, { status: 204, headers });
    }
    if (!['GET', 'HEAD'].includes(request.method))
        return fail(405, 'GET or HEAD only');
    try {
        videoOptions(options);
    }
    catch {
        return fail(400, 'Unsupported video options');
    }
    if (source !== contract.source.url)
        return fail(403, 'Video source not approved');
    if (!bucket)
        return fail(503, 'Video storage unavailable');
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(contract.limits.jobMs)]);
    try {
        const worker = await instance(), info = await worker.fetch(new Request('https://audio-container/video-info', { signal }));
        if (info.status !== 200)
            return fail(503, 'Video encoder unavailable');
        const encoder = await info.json() as {
            revision: string;
        };
        const key = await videoKey(encoder.revision);
        let object = await bucket.head(key), cache = 'HIT';
        if (!object) {
            cache = 'MISS';
            const encoded = await worker.fetch(new Request('https://audio-container/video-transcode', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source_url: source, recipe: contract.recipe, encoderRevision: encoder.revision }) }));
            if (encoded.status === 503)
                return fail(503, 'Video capacity busy');
            if (encoded.status !== 200 || !encoded.body)
                return fail(502, 'Video transform failed');
            const meta = JSON.parse(encoded.headers.get('X-Video-Metadata') || '{}');
            if (meta.encoderRevision !== encoder.revision || meta.sourceSha256 !== contract.source.sha256 || meta.sourceBytes !== contract.source.bytes || meta.recipe !== contract.recipe || !Number.isSafeInteger(meta.bytes) || meta.bytes <= 0 || meta.bytes > contract.limits.bytes || !/^[a-f0-9]{64}$/.test(meta.sha256))
                return fail(502, 'Video metadata invalid');
            // Quarantine bytes under an unaddressable temporary key. Only a verified
            // completed artifact is copied to the canonical delivery key.
            const pending='video-pending/'+crypto.randomUUID();
            const reader=encoded.body.getReader(), digest=createHash('sha256');
            let size=0;
            try {
                const checked=new ReadableStream<Uint8Array>({
                    async pull(controller){
                        try {
                            if(signal.aborted)throw Error('Cancelled');
                            const {done,value}=await reader.read();
                            if(done){controller.close();return;}
                            size+=value.length;
                            if(size>meta.bytes)throw Error('Video bytes exceed bound');
                            digest.update(value);controller.enqueue(value);
                        }catch(error){await reader.cancel(error);controller.error(error);}
                    },
                    cancel(reason){return reader.cancel(reason);}
                });
                const lengthBound=new FixedLengthStream(meta.bytes);
                const transferAbort=new AbortController();
                const pumping=checked.pipeTo(lengthBound.writable,{signal:AbortSignal.any([signal,transferAbort.signal])});
                const storing=bucket.put(pending,lengthBound.readable).catch(error=>{transferAbort.abort(error);throw error;});
                const settled=await Promise.allSettled([pumping,storing]);
                for(const outcome of settled)if(outcome.status==='rejected')throw outcome.reason;
                if(size!==meta.bytes||digest.digest('hex')!==meta.sha256)throw Error('Video byte identity mismatch');
                const staged=await bucket.get(pending);
                if(!staged||signal.aborted)throw Error('Video staging unavailable');
                await bucket.put(key,staged.body,{httpMetadata:{contentType:'video/mp4'},customMetadata:{...Object.fromEntries(Object.entries(meta).map(([k,v])=>[k,typeof v==='object'?JSON.stringify(v):String(v)])),sourceUrl:source}});
            } finally { await reader.cancel().catch(()=>{});await bucket.delete(pending); }
            object = await bucket.head(key);
            if (!object)
                return fail(502, 'Video publication failed');
        }
        const stored = object.customMetadata;
        if (stored?.sourceSha256 !== contract.source.sha256 || stored?.sourceUrl !== source || stored?.encoderRevision !== encoder.revision || stored?.recipe !== contract.recipe || Number(stored?.bytes) !== object.size || !/^[a-f0-9]{64}$/.test(stored?.sha256 || ''))
            return fail(502, 'Video cache metadata invalid');
        let range;
        try {
            range = byteRange(request.headers.get('Range'), object.size);
        }
        catch {
            headers.set('Content-Range', `bytes */${object.size}`);
            return fail(416, 'Range unsatisfiable');
        }
        headers.set('Content-Type', 'video/mp4');
        headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
        headers.set('ETag', '"' + object.customMetadata?.sha256 + '"');
        headers.set('X-Transcode-Cache', cache);
        headers.set('X-Transcode-Encode', 'h264');
        headers.set('Content-Length', String(range?.length ?? object.size));
        if (range)
            headers.set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`);
        if (request.method === 'HEAD')
            return new Response(null, { status: range ? 206 : 200, headers });
        const hit = await bucket.get(key, range ? { range } : undefined);
        if (!hit)
            return fail(502, 'Video cache missing');
        return new Response(hit.body, { status: range ? 206 : 200, headers });
    }
    catch {
        return fail(502, 'Video service unavailable');
    }
}
