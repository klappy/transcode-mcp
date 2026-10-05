import {createHash} from "node:crypto";
import contract from '../../container/video-contract.json';
import a184 from '../../container/video-contract-a184.json';
import a10 from '../../container/video-contract-a10.json';
import xsmall from '../../container/video-contract-xsmall.json';
import small from '../../container/video-contract-small.json';
import compositeSmall from '../../container/video-contract-4k-small.json';
import compositeLarge from '../../container/video-contract-4k-xlarge.json';
import medium from '../../container/video-contract-medium.json';
import extension from '../../container/video-source-extension.json';
import {createVideoCatalog} from '../../container/video-catalog.mjs';
export { contract as videoContract };
export type VideoSize='xsmall'|'small'|'medium'|'large'|'xlarge';
export const videoContracts=[contract,a184,a10];
export const selectVideoContract=createVideoCatalog(videoContracts,{xsmall,small,medium},extension.recipeRevision,[{size:'small',contract:compositeSmall},{size:'xlarge',contract:compositeLarge}]).select;
export function videoOptions(raw: Record<string, string>) {
    for (const [key,value] of Object.entries(raw)) {
        if(key==='size'){if(!['xsmall','small','medium','large','xlarge'].includes(value))throw Error('Unsupported video size');}
        else if(({preset:'fia',q:'medium',f:'mp4'} as Record<string,string>)[key]!==value)throw Error('Unsupported video option');
    }
    return {preset:'fia',q:'medium',f:'mp4',...(raw.size&&raw.size!=='large'?{size:raw.size as VideoSize}:{})} as const;
}
export async function videoKey(encoderRevision: string, selected: typeof contract | typeof small=contract) { if (!/^[a-f0-9]{64}$/.test(encoderRevision))
    throw Error('Invalid encoder revision'); return 'video-v1/' + Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ contract:selected, encoderRevision })))), x => x.toString(16).padStart(2, '0')).join('') + '.mp4'; }
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
export class VideoBusyError extends Error {}
export class VideoDeadlineError extends Error {}
export class VideoOwner {
    private active?: { key: string; consumer: Promise<unknown> };
    constructor(private retain: (promise: Promise<unknown>) => void,
        readonly deadlineMs = 600_000,
        private report: (event: {event:string; deadlineExceeded:boolean}) => void = event => console.error(JSON.stringify(event))) {}
    run<T>(key: string, task: (signal: AbortSignal) => Promise<T>, budgetMs = this.deadlineMs, deadlineSignal?: AbortSignal): Promise<T> {
        if (this.active) {
            if (this.active.key !== key) return Promise.reject(new VideoBusyError('Video capacity busy'));
            return this.active.consumer as Promise<T>;
        }
        if (budgetMs <= 0) return Promise.reject(new VideoDeadlineError('Video admission deadline'));
        const controller = new AbortController();
        let rejectDeadline!: (error: Error) => void;
        const deadline = new Promise<never>((_, reject) => { rejectDeadline = reject; });
        const expire = () => {
            const error = new VideoDeadlineError('Video execution deadline');
            controller.abort(error);
            rejectDeadline(error);
        };
        const timer = setTimeout(expire, Math.min(this.deadlineMs, budgetMs));
        deadlineSignal?.addEventListener('abort', expire, {once:true});
        if (deadlineSignal?.aborted) expire();
        const owner = { key, consumer: undefined as unknown as Promise<T> };
        // The settlement promise, not the consumer race, owns the slot.
        const settlement = Promise.resolve().then(() => task(controller.signal)).finally(() => {
            clearTimeout(timer);
            deadlineSignal?.removeEventListener('abort', expire);
            if (this.active === owner) this.active = undefined;
        });
        owner.consumer = Promise.race([settlement, deadline]);
        this.active = owner;
        this.retain(settlement.catch(() => {
            this.report({event:'video-owner-failed', deadlineExceeded:controller.signal.aborted});
        }));
        return owner.consumer;
    }
}
export async function videoSlot(source: string, count: number, size:string='large') {
    const selected = selectVideoContract(source,size);
    if (!selected || !Number.isSafeInteger(count) || count < 1) throw Error('Invalid video slot');
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(selected))));
    return 'instance-' + (new DataView(hash.buffer).getUint32(0) % count);
}
export async function handleVideoProxy(request: Request, bucket: R2Bucket | undefined, instance: () => Promise<{
    fetch: (r: Request) => Promise<Response>;
}>, source: string, options: Record<string, string>, owner?: VideoOwner): Promise<Response> {
    const consumerStarted = Date.now();
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
    const contract=selectVideoContract(source,options.size);
    if (!contract)
        return fail(403, 'Video source not approved');
    if (!bucket)
        return fail(503, 'Video storage unavailable');
    try {
        const prepare = async (signal = AbortSignal.timeout(contract.limits.jobMs), cacheOnly = false) => {
        signal.throwIfAborted();
        const worker = await instance();
        signal.throwIfAborted();
        const legacySource = videoContracts.find(source => source.source.url === contract.source.url);
        const sourceQuery = legacySource ? 'assetId='+encodeURIComponent(legacySource.source.provenance.assetId) : 'source_url='+encodeURIComponent(contract.source.url);
        const info = await worker.fetch(new Request('https://audio-container/video-info?'+sourceQuery+'&size='+(options.size||'large'), { signal }));
        if (info.status !== 200)
            return fail(503, 'Video encoder unavailable');
        const encoder = await info.json() as {
            revision: string;
        };
        signal.throwIfAborted();
        const key = await videoKey(encoder.revision,contract);
        signal.throwIfAborted();
        let object = await bucket.head(key), cache = 'HIT';
        signal.throwIfAborted();
        if (!object) {
            if (cacheOnly) return null;
            cache = 'MISS';
            const encoded = await worker.fetch(new Request('https://audio-container/video-transcode', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source_url: source, size: options.size||'large', recipe: contract.recipe, encoderRevision: encoder.revision }) }));
            if (encoded.status === 503)
                return fail(503, 'Video capacity busy');
            if (encoded.status !== 200 || !encoded.body)
                return fail(502, 'Video transform failed');
            if (signal.aborted) { await encoded.body.cancel().catch(() => {}); signal.throwIfAborted(); }
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
                signal.throwIfAborted();
                const pumping=checked.pipeTo(lengthBound.writable,{signal:AbortSignal.any([signal,transferAbort.signal])});
                const storing=bucket.put(pending,lengthBound.readable).catch(async error=>{transferAbort.abort(error);await lengthBound.readable.cancel(error).catch(()=>{});throw error;});
                const settled=await Promise.allSettled([pumping,storing]);
                for(const outcome of settled)if(outcome.status==='rejected')throw outcome.reason;
                if(size!==meta.bytes||digest.digest('hex')!==meta.sha256)throw Error('Video byte identity mismatch');
                signal.throwIfAborted();
                const staged=await bucket.get(pending);
                if(!staged||signal.aborted)throw Error('Video staging unavailable');
                await bucket.put(key,staged.body,{httpMetadata:{contentType:'video/mp4'},customMetadata:{...Object.fromEntries(Object.entries(meta).map(([k,v])=>[k,typeof v==='object'?JSON.stringify(v):String(v)])),sourceUrl:source}});
            } finally { await reader.cancel().catch(()=>{});await bucket.delete(pending); }
            signal.throwIfAborted();
            object = await bucket.head(key);
            signal.throwIfAborted();
            if (!object)
                return fail(502, 'Video publication failed');
        }
        const stored = object.customMetadata;
        if (stored?.sourceSha256 !== contract.source.sha256 || stored?.sourceUrl !== source || stored?.encoderRevision !== encoder.revision || stored?.recipe !== contract.recipe || Number(stored?.bytes) !== object.size || !/^[a-f0-9]{64}$/.test(stored?.sha256 || ''))
            return fail(502, 'Video cache metadata invalid');
        return { object, key, cache };
        };
        // Read-only lookup must not compete for the retained encode slot. R2 cannot
        // be cancelled; abort plus the race prevents a late lookup starting work.
        const lookupController = new AbortController();
        const lookupBudget = Math.min(owner?.deadlineMs ?? contract.limits.jobMs, contract.limits.jobMs) - (Date.now() - consumerStarted);
        if (lookupBudget <= 0) throw new VideoDeadlineError('Video lookup deadline');
        let lookupTimer: ReturnType<typeof setTimeout>;
        const timeout = new Promise<never>((_, reject) => {
            lookupTimer = setTimeout(() => {
                const error = new VideoDeadlineError('Video lookup deadline');
                lookupController.abort(error); reject(error);
            }, lookupBudget);
        });
        let prepared;
        try {
            const cached = await Promise.race([prepare(lookupController.signal, true), timeout]);
            lookupController.signal.throwIfAborted();
            // A miss rechecks under the original owner. The consumer deadline
            // still covers lookup plus preparation; retained work settles separately.
            const remaining = consumerStarted + Math.min(owner?.deadlineMs ?? contract.limits.jobMs, contract.limits.jobMs) - Date.now();
            if (remaining <= 0) throw new VideoDeadlineError('Video admission deadline');
            prepared = cached ?? await Promise.race([
                owner ? owner.run(JSON.stringify(contract), prepare, remaining, lookupController.signal) : prepare(lookupController.signal), timeout
            ]);
        } finally { clearTimeout(lookupTimer!); }
        if (!prepared) throw Error('Video preparation missing');
        if (prepared instanceof Response) return prepared.clone();
        const { object, key, cache } = prepared;
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
        const remaining = consumerStarted + Math.min(owner?.deadlineMs ?? contract.limits.jobMs, contract.limits.jobMs) - Date.now();
        if (remaining <= 0) throw new VideoDeadlineError('Video response deadline');
        // This is a read-only consumer acquisition, not the retained publication.
        // R2 cannot be cancelled; a late body is discarded without starting work.
        const hit = await new Promise<R2ObjectBody | null>((resolve, reject) => {
            let expired = false;
            const timer = setTimeout(() => { expired = true; reject(new VideoDeadlineError('Video response deadline')); }, remaining);
            bucket.get(key, range ? { range } : undefined).then(value => {
                clearTimeout(timer);
                if (expired) { value?.body.cancel().catch(() => {}); return; }
                resolve(value);
            }, error => { clearTimeout(timer); if (!expired) reject(error); });
        });
        if (!hit)
            return fail(502, 'Video cache missing');
        return new Response(hit.body, { status: range ? 206 : 200, headers });
    }
    catch (error) {
        if (error instanceof VideoDeadlineError) return fail(504, 'Video execution deadline; completion may still settle');
        if (error instanceof VideoBusyError) return fail(503, 'Video capacity busy');
        return fail(502, 'Video service unavailable');
    }
}
