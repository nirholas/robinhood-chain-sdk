import { formatUnits, parseUnits, type Address, type Hash } from 'viem'
import { erc20Abi } from './abis.js'
import { MAINNET_ADDRESSES, TESTNET_ADDRESSES, USDG_DECIMALS } from './addresses.js'
import type { HoodClient } from './client.js'
import { NoAccountError } from './errors.js'

/**
 * USDG — Paxos Global Dollar, Robinhood Chain's dollar stablecoin.
 *
 * Facts verified on Blockscout during SDK development:
 * - Mainnet address `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` (ERC-1967
 *   proxy onto Paxos' verified `USDG` implementation), **6 decimals**.
 * - USDG **does** implement EIP-2612 `permit`, despite the Blockscout-verified
 *   implementation ABI showing no `permit`/`nonces`. USDG is a facet/diamond
 *   token: reading the implementation alone understates its surface. Probing
 *   the router directly on mainnet settles it, with a nonsense selector as a
 *   negative control to prove the check discriminates:
 *
 *   ```
 *   getFacet(0xd505accf) permit   -> 0x780d30b6a89BC9Eef953a543aA288c3B05b01309
 *   getFacet(0x7ecebe00) nonces   -> 0x780d30b6a89BC9Eef953a543aA288c3B05b01309
 *   getFacet(0xe3ee160e) transfer -> 0x780d30b6a89BC9Eef953a543aA288c3B05b01309
 *   getFacet(0xdeadbeef) control  -> 0x0000000000000000000000000000000000000000
 *   ```
 *
 *   `nonces(address)` answers with a value rather than reverting, confirming
 *   the facet is live and not merely registered. Gasless approvals ARE
 *   possible. For moving USDG, prefer EIP-3009 `transferWithAuthorization`
 *   anyway: `permit` authorizes an allowance rather than a transfer, needs a
 *   second call to collect, leaves a standing allowance behind, and binds
 *   neither the recipient nor the exact amount into the signature.
 */

/** USDG contract address for the client's network. */
export function usdgAddress(client: HoodClient): Address {
  return client.network === 'testnet' ? TESTNET_ADDRESSES.usdg : MAINNET_ADDRESSES.usdg
}

/** Format a raw 6-decimal USDG amount as a decimal string. */
export function formatUsdg(amount: bigint): string {
  return formatUnits(amount, USDG_DECIMALS)
}

/** Parse a decimal string (e.g. `"12.50"`) into a raw 6-decimal USDG amount. */
export function parseUsdg(amount: string): bigint {
  return parseUnits(amount, USDG_DECIMALS)
}

/** USDG balance of `owner` (raw, 6 decimals — use {@link formatUsdg} to display). */
export async function getUsdgBalance(client: HoodClient, owner: Address): Promise<bigint> {
  return client.public.readContract({
    address: usdgAddress(client),
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [owner],
  })
}

/** USDG total supply on the client's network (raw, 6 decimals). */
export async function getUsdgTotalSupply(client: HoodClient): Promise<bigint> {
  return client.public.readContract({
    address: usdgAddress(client),
    abi: erc20Abi,
    functionName: 'totalSupply',
  })
}

/**
 * Transfer USDG. Requires a wallet account on the client.
 * @returns The transaction hash. Await confirmation with
 * `client.public.waitForTransactionReceipt({ hash })`.
 */
export async function transferUsdg(client: HoodClient, to: Address, amount: bigint): Promise<Hash> {
  if (!client.wallet) throw new NoAccountError('transferUsdg')
  return client.wallet.writeContract({
    address: usdgAddress(client),
    abi: erc20Abi,
    functionName: 'transfer',
    args: [to, amount],
  })
}

/**
 * Approve `spender` for `amount` USDG. Requires a wallet account.
 *
 * This is the on-chain allowance path, which costs the owner gas. USDG also
 * exposes EIP-2612 `permit` through its facet router (see the module header),
 * so a signed allowance is possible when the owner cannot pay gas.
 */
export async function approveUsdg(client: HoodClient, spender: Address, amount: bigint): Promise<Hash> {
  if (!client.wallet) throw new NoAccountError('approveUsdg')
  return client.wallet.writeContract({
    address: usdgAddress(client),
    abi: erc20Abi,
    functionName: 'approve',
    args: [spender, amount],
  })
}

/** Current USDG allowance from `owner` to `spender` (raw, 6 decimals). */
export async function getUsdgAllowance(
  client: HoodClient,
  owner: Address,
  spender: Address,
): Promise<bigint> {
  return client.public.readContract({
    address: usdgAddress(client),
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, spender],
  })
}
