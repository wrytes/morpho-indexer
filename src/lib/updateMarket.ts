import { type Context } from 'ponder:registry';
import { market, marketDailyLog } from 'ponder:schema';
import { Hex } from 'viem';
import { deriveMarket } from './derive';

type Db = Context['db'];
type MarketRow = typeof market.$inferSelect;

export type MarketPatch = Partial<
	Pick<
		MarketRow,
		| 'totalSupplyAssets'
		| 'totalSupplyShares'
		| 'totalBorrowAssets'
		| 'totalBorrowShares'
		| 'totalCollateral'
		| 'fee'
		| 'lastUpdate'
		| 'lastBorrowRate'
		| 'badDebtAssets'
		| 'cumulativeInterest'
	>
>;

interface Flows {
	supplied?: bigint;
	withdrawn?: bigint;
	borrowed?: bigint;
	repaid?: bigint;
	collateralIn?: bigint;
	collateralOut?: bigint;
	liquidatedRepaid?: bigint;
	interest?: bigint;
}

interface Props {
	db: Db;
	chainId: number;
	marketId: Hex;
	timestamp: bigint;
	/** Compute the state patch from the current row (so multi-field updates see consistent values). */
	patch: (m: MarketRow) => MarketPatch;
	flows?: Flows;
	/** counters to bump */
	counters?: { supplyCount?: number; borrowCount?: number; liquidationCount?: number };
	/** AccrueInterest/SetFee are bookkeeping, not user activity */
	isActivity?: boolean;
}

/** Applies an event's delta to the market row, re-derives the readable columns and rolls the daily snapshot. */
export async function updateMarket({ db, chainId, marketId, timestamp, patch, flows = {}, counters = {}, isActivity = true }: Props) {
	const current = await db.find(market, { chainId, id: marketId });
	if (!current) return; // market not created by us (cannot happen when indexing from the factory block)

	const next = { ...current, ...patch(current) };
	const derived = deriveMarket({ ...next, loanDecimals: next.loanDecimals, collateralDecimals: next.collateralDecimals });

	await db.update(market, { chainId, id: marketId }).set({
		...patch(current),
		...derived,
		lastActivityAt: isActivity ? timestamp : current.lastActivityAt,
		supplyCount: current.supplyCount + (counters.supplyCount ?? 0),
		borrowCount: current.borrowCount + (counters.borrowCount ?? 0),
		liquidationCount: current.liquidationCount + (counters.liquidationCount ?? 0),
	});

	// daily snapshot
	const dateObj = new Date(Number(timestamp) * 1000);
	const dayStart = BigInt(Math.floor(dateObj.setUTCHours(0, 0, 0, 0) / 1000));
	const day = new Date(Number(dayStart) * 1000).toISOString().split('T')[0]!;

	const existing = await db.find(marketDailyLog, { chainId, marketId, day });
	const state = {
		totalSupplyAssets: next.totalSupplyAssets,
		totalBorrowAssets: next.totalBorrowAssets,
		totalCollateral: next.totalCollateral,
		utilization: derived.utilization,
		borrowApy: derived.borrowApy,
		supplyApy: derived.supplyApy,
	};

	if (!existing) {
		await db.insert(marketDailyLog).values({
			chainId,
			marketId,
			day,
			timestamp: dayStart,
			...state,
			supplied: flows.supplied ?? 0n,
			withdrawn: flows.withdrawn ?? 0n,
			borrowed: flows.borrowed ?? 0n,
			repaid: flows.repaid ?? 0n,
			collateralIn: flows.collateralIn ?? 0n,
			collateralOut: flows.collateralOut ?? 0n,
			liquidatedRepaid: flows.liquidatedRepaid ?? 0n,
			interest: flows.interest ?? 0n,
			eventCount: 1,
		});
	} else {
		await db.update(marketDailyLog, { chainId, marketId, day }).set({
			...state,
			supplied: existing.supplied + (flows.supplied ?? 0n),
			withdrawn: existing.withdrawn + (flows.withdrawn ?? 0n),
			borrowed: existing.borrowed + (flows.borrowed ?? 0n),
			repaid: existing.repaid + (flows.repaid ?? 0n),
			collateralIn: existing.collateralIn + (flows.collateralIn ?? 0n),
			collateralOut: existing.collateralOut + (flows.collateralOut ?? 0n),
			liquidatedRepaid: existing.liquidatedRepaid + (flows.liquidatedRepaid ?? 0n),
			interest: existing.interest + (flows.interest ?? 0n),
			eventCount: existing.eventCount + 1,
		});
	}
}
