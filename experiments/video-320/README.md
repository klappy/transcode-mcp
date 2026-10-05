# Private 320p comparison

This manual-only harness reuses exact retained a13 source evidence from artifact11321498762/run37253567874. It does not add a server target or encode on push/PR. Missing/expired retained source fails closed. No origin fallback or automatic rerun.

The one video is H26450fps,568×320 with640:639SAR,88889bps two-pass, AAC42667bps mono. One separate Opus voice Low8kbps mono reference is produced from the same source for actual listening. Rates across codecs are not a perceptual-equivalence claim. Three core presets stay unchanged.

After independent exact commit review and root publication, root can dispatch once:

```sh
gh workflow run video-320-experiment.yml --repo klappy/transcode-mcp --ref <reviewed-branch> -f reviewed_commit=<full-reviewed-commit>
```

No dispatch has been performed by the author. The revision check must pass before Docker or encoding. Inspect uploaded `optional-320-measurement/receipt.json`, complete output/source identities, actual settings/pass times, full-decode flags, audio reference, frames, cleanup and budget status. `measured-budget-rejected` is a failed budget qualification even if artifact collection exits successfully. Both statuses still require independent visual/motion/listening/browser acceptance; never label a smaller file a quality win without that evidence. Root may reuse the existing retained compact/HQ files for matching frame comparisons without another encode.

Execution limits:10min shared script deadline,300s combined video passes,120s audio reference,60MiB per output,32MiB individual/64MiB aggregate passlogs,384MiB source+evidence+16MiB tmpfs accounting. The container is read-only except evidence/tmpfs and has no network. Worst-case storage is reserved before either encode. Workflow cleanup removes its single named container; failures/partial receipts are uploaded, no retry.
