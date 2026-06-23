// test-setup.ts — bun test preload.
//
// AudioContainer extends Container from "@cloudflare/containers", which imports
// the workerd-only "cloudflare:workers" built-in at module load. That can't
// resolve under bun (or any non-workerd runtime), so importing worker.ts in a
// test would throw before any assertion runs. Mock the module with a minimal
// stub: a constructable base class (so `extends Container` is valid) and a
// getRandom stub. The audio container path is never exercised in unit tests
// (no AUDIO_CONTAINER binding is provided), so the stubs only need to satisfy
// module load and class definition.
import { mock } from "bun:test";

mock.module("@cloudflare/containers", () => ({
  Container: class {
    constructor(..._args: unknown[]) {}
  },
  getRandom: () => ({}),
}));
