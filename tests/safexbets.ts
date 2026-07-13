import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Safexbets } from "../target/types/safexbets";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { assert } from "chai";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("safexbets — no-loss market happy path", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Workspace key casing varies across Anchor versions — accept either.
  const program = (anchor.workspace.safexbets ??
    anchor.workspace.Safexbets) as Program<Safexbets>;

  const authority = (provider.wallet as anchor.Wallet).payer;
  const alice = Keypair.generate(); // bets YES → wins
  const bob = Keypair.generate(); //   bets NO  → loses

  const decimals = 6;
  const unit = 10 ** decimals;
  const matchId = new BN(Math.floor(Math.random() * 1_000_000));

  let mint: PublicKey;
  let authorityAta: PublicKey;
  let aliceAta: PublicKey;
  let bobAta: PublicKey;

  const [market] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), matchId.toArrayLike(Buffer, "le", 8)],
    program.programId
  );
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), market.toBuffer()],
    program.programId
  );
  const positionOf = (owner: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("position"), market.toBuffer(), owner.toBuffer()],
      program.programId
    )[0];

  before(async () => {
    for (const kp of [alice, bob]) {
      const sig = await provider.connection.requestAirdrop(
        kp.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);
    }
    mint = await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      decimals
    );
    const ata = async (owner: PublicKey) =>
      (
        await getOrCreateAssociatedTokenAccount(
          provider.connection,
          authority,
          mint,
          owner
        )
      ).address;
    authorityAta = await ata(authority.publicKey);
    aliceAta = await ata(alice.publicKey);
    bobAta = await ata(bob.publicKey);
    await mintTo(provider.connection, authority, mint, aliceAta, authority, 10_000 * unit);
    await mintTo(provider.connection, authority, mint, bobAta, authority, 10_000 * unit);
    await mintTo(provider.connection, authority, mint, authorityAta, authority, 10_000 * unit);
  });

  it("bet → settle → accrue → winner claims, loser recovers principal", async () => {
    const now = Math.floor(Date.now() / 1000);
    const kickoff = new BN(now + 3);
    const lockPeriod = new BN(1); // 1s lock so the test can withdraw quickly

    await program.methods
      .initializeMarket(matchId, "Home to win?", kickoff, lockPeriod)
      .accounts({ authority: authority.publicKey, principalMint: mint, market, vault })
      .rpc();

    await program.methods
      .placeBet({ yes: {} }, new BN(1000 * unit))
      .accounts({ bettor: alice.publicKey, market, vault, bettorToken: aliceAta, position: positionOf(alice.publicKey) })
      .signers([alice])
      .rpc();

    await program.methods
      .placeBet({ no: {} }, new BN(500 * unit))
      .accounts({ bettor: bob.publicKey, market, vault, bettorToken: bobAta, position: positionOf(bob.publicKey) })
      .signers([bob])
      .rpc();

    await sleep(4000); // pass kickoff

    await program.methods
      .settle({ yes: {} })
      .accounts({ authority: authority.publicKey, market })
      .rpc();

    // Simulate the losing (NO) pool earning 50 mock-USDC of yield over the lock.
    await program.methods
      .accrue({ no: {} }, new BN(50 * unit))
      .accounts({ authority: authority.publicKey, market, vault, authorityToken: authorityAta })
      .rpc();

    const aliceBefore = Number((await getAccount(provider.connection, aliceAta)).amount);
    await program.methods
      .claim()
      .accounts({ owner: alice.publicKey, market, vault, position: positionOf(alice.publicKey), ownerToken: aliceAta })
      .signers([alice])
      .rpc();
    const aliceAfter = Number((await getAccount(provider.connection, aliceAta)).amount);
    // principal 1000 + full loser yield 50 (Alice is the only YES staker) = 1050
    assert.equal(aliceAfter - aliceBefore, 1050 * unit, "winner: principal + losers' yield");

    await sleep(2000); // pass the 1s loser lock

    const bobBefore = Number((await getAccount(provider.connection, bobAta)).amount);
    await program.methods
      .withdrawPrincipal()
      .accounts({ owner: bob.publicKey, market, vault, position: positionOf(bob.publicKey), ownerToken: bobAta })
      .signers([bob])
      .rpc();
    const bobAfter = Number((await getAccount(provider.connection, bobAta)).amount);
    assert.equal(bobAfter - bobBefore, 500 * unit, "loser recovers 100% of principal");
  });
});
