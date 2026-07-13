# IDL — `safexbets.json`

`safexbets.json` in this folder is a **hand-written placeholder** so the frontend typechecks and
builds on a machine without the Solana/Anchor toolchain (e.g. the Windows dev box).

It is a structurally-valid Anchor **0.30+** IDL: the account layouts, instruction args, enums and
discriminators mirror `programs/safexbets/src/` exactly, so it can even decode accounts from a
deployment that matches the current program.

## On the Mac, after `anchor build`, copy the real IDL over this file:

```bash
# from the repo root, after `anchor build`
cp target/idl/safexbets.json app/src/idl/safexbets.json
```

`anchor build` regenerates `target/idl/safexbets.json` from the Rust source, so it is always the
source of truth. Overwriting the placeholder guarantees the discriminators match the deployed
program byte-for-byte.

> The frontend reads the program **address** from `NEXT_PUBLIC_PROGRAM_ID` at runtime and injects it
> into the IDL, so the `address` field baked into this JSON does not need to be correct — but keeping
> the real one here after deploy is harmless and convenient.
