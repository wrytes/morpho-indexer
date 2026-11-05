import { index, onchainTable, primaryKey } from 'ponder';

/**
 * One row per Morpho Blue market. State is reconstructed from events (no RPC reads per event).
 *
 * - bigint columns: exact on-chain values (raw token units / WAD)
 * - real columns: derived, human-readable, intended for filtering/sorting (loan-token units, ratios, APY as fraction: 0.05 = 5%)
 */
export const market = onchainTable(
	'market',
	(t) => ({
		chainId: t.integer().notNull(),
		id: t.hex().notNull(), // bytes32 market id

		// MarketParams
		loanToken: t.hex().notNull(),
		collateralToken: t.hex().notNull(), // 0x0 => idle market (no collateral)
		oracle: t.hex().notNull(),
		irm: t.hex().notNull(),
		lltv: t.bigint().notNull(), // WAD
		lltvPct: t.real().notNull(),

		// token metadata
		loanSymbol: t.text().notNull(),
		loanDecimals: t.integer().notNull(),
		collateralSymbol: t.text().notNull(),
		collateralDecimals: t.integer().notNull(),

		createdAt: t.bigint().notNull(),
		createdBlock: t.bigint().notNull(),

		// on-chain market state (mirrors Morpho.market(id))
		totalSupplyAssets: t.bigint().notNull(),
		totalSupplyShares: t.bigint().notNull(),
		totalBorrowAssets: t.bigint().notNull(),
		totalBorrowShares: t.bigint().notNull(),
		totalCollateral: t.bigint().notNull(), // not part of Market struct, summed from collateral events
		fee: t.bigint().notNull(), // WAD
		lastUpdate: t.bigint().notNull(), // last AccrueInterest timestamp
		lastBorrowRate: t.bigint().notNull(), // WAD per second, rate used in the last accrual

		// derived (loan token units)
		supplyUnits: t.real().notNull(), // "TVL" of the market = total supplied
		borrowUnits: t.real().notNull(),
		liquidityUnits: t.real().notNull(), // supply - borrow, i.e. what can still be borrowed
		collateralUnits: t.real().notNull(), // collateral token units
		utilization: t.real().notNull(), // 0..1
		borrowApy: t.real().notNull(),
		supplyApy: t.real().notNull(), // net of protocol fee

		// activity
		lastActivityAt: t.bigint().notNull(),
		supplyCount: t.integer().notNull(),
		borrowCount: t.integer().notNull(),
		liquidationCount: t.integer().notNull(),
		badDebtAssets: t.bigint().notNull(), // cumulative realized bad debt (loan token)
		cumulativeInterest: t.bigint().notNull(), // cumulative interest accrued (loan token)
	}),
	(table) => ({
		pk: primaryKey({ columns: [table.chainId, table.id] }),
		loanIdx: index().on(table.loanToken),
		collateralIdx: index().on(table.collateralToken),
		supplyIdx: index().on(table.supplyUnits),
		utilIdx: index().on(table.utilization),
		borrowApyIdx: index().on(table.borrowApy),
	})
);

/** One row per market per UTC day — end-of-day state plus the day's flows. */
export const marketDailyLog = onchainTable(
	'marketDailyLog',
	(t) => ({
		chainId: t.integer().notNull(),
		marketId: t.hex().notNull(),
		day: t.text().notNull(), // YYYY-MM-DD (UTC)
		timestamp: t.bigint().notNull(), // start of day

		// end-of-day state
		totalSupplyAssets: t.bigint().notNull(),
		totalBorrowAssets: t.bigint().notNull(),
		totalCollateral: t.bigint().notNull(),
		utilization: t.real().notNull(),
		borrowApy: t.real().notNull(),
		supplyApy: t.real().notNull(),

		// flows (loan token raw units, collateral for the collateral columns)
		supplied: t.bigint().notNull(),
		withdrawn: t.bigint().notNull(),
		borrowed: t.bigint().notNull(),
		repaid: t.bigint().notNull(),
		collateralIn: t.bigint().notNull(),
		collateralOut: t.bigint().notNull(),
		liquidatedRepaid: t.bigint().notNull(),
		interest: t.bigint().notNull(),
		eventCount: t.integer().notNull(),
	}),
	(table) => ({
		pk: primaryKey({ columns: [table.chainId, table.marketId, table.day] }),
		dayIdx: index().on(table.day),
	})
);

export const marketLiquidation = onchainTable(
	'marketLiquidation',
	(t) => ({
		chainId: t.integer().notNull(),
		txHash: t.hex().notNull(),
		logIndex: t.integer().notNull(),
		createdAt: t.bigint().notNull(),
		blockheight: t.bigint().notNull(),

		marketId: t.hex().notNull(),
		caller: t.hex().notNull(),
		borrower: t.hex().notNull(),
		repaidAssets: t.bigint().notNull(),
		repaidShares: t.bigint().notNull(),
		seizedAssets: t.bigint().notNull(),
		badDebtAssets: t.bigint().notNull(),
		badDebtShares: t.bigint().notNull(),
	}),
	(table) => ({
		pk: primaryKey({ columns: [table.chainId, table.txHash, table.logIndex] }),
		marketIdx: index().on(table.marketId),
	})
);
