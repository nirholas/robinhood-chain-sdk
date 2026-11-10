---
name: hoodchain-sdk
description: Use the hoodchain TypeScript SDK to read Robinhood Chain (4663) Stock Token quotes and portfolios, quote and execute Uniswap v3 swaps, handle USDG, and watch launchpad launches. Use when writing or running TypeScript that talks to Robinhood Chain.
---

# hoodchain SDK

`hoodchain` (npm, `npm install hoodchain viem`) wraps viem for Robinhood Chain. Mainnet is chain 4663, testnet 46630.

## Client

```ts
import { createHoodClient } from 'hoodchain'
const hood = createHoodClient()                     // mainnet, public RPC, read only
const test = createHoodClient({ chain: 'testnet' }) // testnet
```

`HoodClientConfig` fields: `chain` (`mainnet` or `testnet`), `rpcUrl`, `transport`, `account` (a viem account, needed for writes) and `acknowledgeStockTokenEligibility`. A client without an `account` is read only.

## Reads

- `getQuote(hood, 'AAPL', { maxAgeSeconds })` returns `priceUsd` and feed metadata. Chainlink's answer is already multiplier-adjusted, so do not multiply by the multiplier again. Throws `FeedNotFoundError`, `StaleFeedError` or `InvalidFeedAnswerError`.
- `getMultiplier(hood, symbol)`, `getPosition`, `getPortfolio(hood, '0xAddress')` (positions with `balanceTokens`, `shareEquivalent`, `valueUsd`, plus `totalUsd`).
- Registry: `listStockTokens`, `listPricedStockTokens`, `getStockToken`, `getStockTokenByAddress`.
- USDG: `getUsdgBalance`, `getUsdgTotalSupply`, `getUsdgAllowance`, `formatUsdg`, `parseUsdg`.
- Launchpads: `getRecentLaunches(hood, { lookbackBlocks })`, `watchLaunches(hood, cb)`, `watchCurveTrades`, `watchGraduations`.
- Feed: `subscribeFeed(cb)` streams sequenced transactions, `watchTransfers`. Uses the global `WebSocket` on Node 22+, otherwise install the optional `ws` peer.

## Swaps and transfers (spend funds)

`quoteSwap(hood, { tokenIn, tokenOut, amountIn })` probes every v3 fee tier and two-hop routes via WETH and USDG and returns the best route. It is a read. `executeSwap(hood, { tokenIn, tokenOut, amountIn })` quotes, approves if needed, sends and waits for the receipt. `transferUsdg` and `approveUsdg` also sign. Typed errors include `NoRouteError`, `SlippageExceededError` and `NoAccountError`.

Acquiring a canonical Stock Token throws `StockTokenEligibilityError` until the operator sets `acknowledgeStockTokenEligibility: true`. That flag is an eligibility statement by the operator (the tokens may not be offered to US persons, with further limits for Canada, the UK and Switzerland), so never set it on the user's behalf.

Rules for the agent:

1. Use `quoteSwap` first and show the user the route and output.
2. Before `executeSwap`, `transferUsdg` or `approveUsdg`, show recipient or router, amount, token and network, and stop for an explicit yes.
3. Load keys from the user's own environment (for example `process.env.ROBINHOOD_CHAIN_PRIVATE_KEY` via `privateKeyToAccount`). Never ask for one in chat or write one to a file. Prefer the testnet while developing.

## Example

```ts
import { createHoodClient, getQuote, getPortfolio } from 'hoodchain'
const hood = createHoodClient()
const aapl = await getQuote(hood, 'AAPL')
console.log(aapl.priceUsd)
const portfolio = await getPortfolio(hood, '0xYourAddress')
console.log(portfolio.totalUsd)
```
