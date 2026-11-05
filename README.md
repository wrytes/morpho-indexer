# morpho-indexer

Event indexer for [Morpho Blue](https://docs.morpho.org/) (singleton `0xBBBB…FFCb`, Ethereum + Base). Rebuilds the full state of **every market** from events — no per-event RPC reads — so all markets can be filtered by TVL, utilization, rates, LLTV, activity, bad debt etc. for arbitrage / cheap-borrow hunting.

Built with [Ponder](https://ponder.sh), modeled after `ysyBold-indexer`.

## Setup

```
cp .env.example .env.local   # set ALCHEMY_RPC_KEY (or RPC_URL_<chainId>)
yarn install
yarn dev
```

## What is indexed

| Table | Content |
| --- | --- |
| `market` | one row per market: params, token symbols/decimals, supply/borrow/collateral totals, fee, last borrow rate, derived `supplyUnits`, `borrowUnits`, `liquidityUnits`, `utilization`, `borrowApy`, `supplyApy`, activity counters, bad debt |
| `marketDailyLog` | per market per UTC day: end-of-day state + supplied/withdrawn/borrowed/repaid/liquidated/interest flows |
| `marketLiquidation` | every liquidation (incl. bad debt) |

Units: `*Units` are in **loan-token units** (1500 = 1500 USDC), `utilization` / `*Apy` are fractions (0.05 = 5%).

## Querying

`GET /markets` — filter + sort (see `src/api/index.ts` for all params):

```
# tiny, cheap-to-borrow USDC markets
/markets?loan=USDC&maxSupply=100000&maxBorrowApy=0.02&activeWithinDays=30&sort=borrowApy&order=asc

# low utilization, plenty of borrowable liquidity
/markets?maxUtilization=0.3&minLiquidity=50000&sort=liquidity

# markets that took bad debt
/markets?hasBadDebt=true&sort=badDebt
```

`GET /markets/:chainId/:id?days=90` — one market + daily history. Also `/graphql` and `/sql/*` (SQL over HTTP, tables above).

## Caveats

- `borrowApy` / `supplyApy` come from the rate emitted by the last `AccrueInterest`, i.e. the rate **before** the last interaction. For idle markets (Morpho's adaptive IRM keeps drifting) it is stale — check `lastUpdate`. A live read of `IRM.borrowRateView` is the natural next step.
- Amounts are not USD-normalised; compare within the same loan token, or add a price feed.
- Start blocks (`18883124` Ethereum, `13977148` Base) are the documented Morpho Blue deployments.
