import { ponder } from 'ponder:registry';
import { market, marketLiquidation } from 'ponder:schema';
import { deriveMarket, lltvToPct, zeroFloorSub } from './lib/derive';
import { readToken } from './lib/tokens';
import { updateMarket } from './lib/updateMarket';

ponder.on('morphoBlue:CreateMarket', async ({ event, context }) => {
	const { id, marketParams: p } = event.args;
	const chainId = context.chain.id;

	const [loan, collateral] = await Promise.all([readToken(context.client, p.loanToken), readToken(context.client, p.collateralToken)]);

	const state = {
		totalSupplyAssets: 0n,
		totalBorrowAssets: 0n,
		totalCollateral: 0n,
		lastBorrowRate: 0n,
		fee: 0n,
	};

	await context.db.insert(market).values({
		chainId,
		id,
		loanToken: p.loanToken,
		collateralToken: p.collateralToken,
		oracle: p.oracle,
		irm: p.irm,
		lltv: p.lltv,
		lltvPct: lltvToPct(p.lltv),

		loanSymbol: loan.symbol,
		loanDecimals: loan.decimals,
		collateralSymbol: collateral.symbol,
		collateralDecimals: collateral.decimals,

		createdAt: event.block.timestamp,
		createdBlock: event.block.number,

		totalSupplyShares: 0n,
		totalBorrowShares: 0n,
		lastUpdate: event.block.timestamp,
		...state,
		...deriveMarket({ ...state, loanDecimals: loan.decimals, collateralDecimals: collateral.decimals }),

		lastActivityAt: event.block.timestamp,
		supplyCount: 0,
		borrowCount: 0,
		liquidationCount: 0,
		badDebtAssets: 0n,
		cumulativeInterest: 0n,
	});
});

ponder.on('morphoBlue:Supply', async ({ event, context }) => {
	const { id, assets, shares } = event.args;
	await updateMarket({
		db: context.db,
		chainId: context.chain.id,
		marketId: id,
		timestamp: event.block.timestamp,
		patch: (m) => ({ totalSupplyAssets: m.totalSupplyAssets + assets, totalSupplyShares: m.totalSupplyShares + shares }),
		flows: { supplied: assets },
		counters: { supplyCount: 1 },
	});
});

ponder.on('morphoBlue:Withdraw', async ({ event, context }) => {
	const { id, assets, shares } = event.args;
	await updateMarket({
		db: context.db,
		chainId: context.chain.id,
		marketId: id,
		timestamp: event.block.timestamp,
		patch: (m) => ({
			totalSupplyAssets: zeroFloorSub(m.totalSupplyAssets, assets),
			totalSupplyShares: zeroFloorSub(m.totalSupplyShares, shares),
		}),
		flows: { withdrawn: assets },
		counters: { supplyCount: 1 },
	});
});

ponder.on('morphoBlue:Borrow', async ({ event, context }) => {
	const { id, assets, shares } = event.args;
	await updateMarket({
		db: context.db,
		chainId: context.chain.id,
		marketId: id,
		timestamp: event.block.timestamp,
		patch: (m) => ({ totalBorrowAssets: m.totalBorrowAssets + assets, totalBorrowShares: m.totalBorrowShares + shares }),
		flows: { borrowed: assets },
		counters: { borrowCount: 1 },
	});
});

ponder.on('morphoBlue:Repay', async ({ event, context }) => {
	const { id, assets, shares } = event.args;
	await updateMarket({
		db: context.db,
		chainId: context.chain.id,
		marketId: id,
		timestamp: event.block.timestamp,
		patch: (m) => ({
			totalBorrowAssets: zeroFloorSub(m.totalBorrowAssets, assets),
			totalBorrowShares: zeroFloorSub(m.totalBorrowShares, shares),
		}),
		flows: { repaid: assets },
		counters: { borrowCount: 1 },
	});
});

ponder.on('morphoBlue:SupplyCollateral', async ({ event, context }) => {
	const { id, assets } = event.args;
	await updateMarket({
		db: context.db,
		chainId: context.chain.id,
		marketId: id,
		timestamp: event.block.timestamp,
		patch: (m) => ({ totalCollateral: m.totalCollateral + assets }),
		flows: { collateralIn: assets },
		counters: { borrowCount: 1 },
	});
});

ponder.on('morphoBlue:WithdrawCollateral', async ({ event, context }) => {
	const { id, assets } = event.args;
	await updateMarket({
		db: context.db,
		chainId: context.chain.id,
		marketId: id,
		timestamp: event.block.timestamp,
		patch: (m) => ({ totalCollateral: zeroFloorSub(m.totalCollateral, assets) }),
		flows: { collateralOut: assets },
		counters: { borrowCount: 1 },
	});
});

ponder.on('morphoBlue:Liquidate', async ({ event, context }) => {
	const { id, caller, borrower, repaidAssets, repaidShares, seizedAssets, badDebtAssets, badDebtShares } = event.args;

	await context.db.insert(marketLiquidation).values({
		chainId: context.chain.id,
		txHash: event.transaction.hash,
		logIndex: event.log.logIndex,
		createdAt: event.block.timestamp,
		blockheight: event.block.number,
		marketId: id,
		caller,
		borrower,
		repaidAssets,
		repaidShares,
		seizedAssets,
		badDebtAssets,
		badDebtShares,
	});

	// Morpho: repaid debt leaves borrow; bad debt is socialized, i.e. removed from both borrow and supply assets
	await updateMarket({
		db: context.db,
		chainId: context.chain.id,
		marketId: id,
		timestamp: event.block.timestamp,
		patch: (m) => ({
			totalBorrowAssets: zeroFloorSub(zeroFloorSub(m.totalBorrowAssets, repaidAssets), badDebtAssets),
			totalBorrowShares: zeroFloorSub(m.totalBorrowShares, repaidShares + badDebtShares),
			totalSupplyAssets: zeroFloorSub(m.totalSupplyAssets, badDebtAssets),
			totalCollateral: zeroFloorSub(m.totalCollateral, seizedAssets),
			badDebtAssets: m.badDebtAssets + badDebtAssets,
		}),
		flows: { liquidatedRepaid: repaidAssets, collateralOut: seizedAssets },
		counters: { liquidationCount: 1 },
	});
});

ponder.on('morphoBlue:AccrueInterest', async ({ event, context }) => {
	const { id, prevBorrowRate, interest, feeShares } = event.args;
	await updateMarket({
		db: context.db,
		chainId: context.chain.id,
		marketId: id,
		timestamp: event.block.timestamp,
		patch: (m) => ({
			totalBorrowAssets: m.totalBorrowAssets + interest,
			totalSupplyAssets: m.totalSupplyAssets + interest,
			totalSupplyShares: m.totalSupplyShares + feeShares,
			lastBorrowRate: prevBorrowRate,
			lastUpdate: event.block.timestamp,
			cumulativeInterest: m.cumulativeInterest + interest,
		}),
		flows: { interest },
		isActivity: false,
	});
});

ponder.on('morphoBlue:SetFee', async ({ event, context }) => {
	await updateMarket({
		db: context.db,
		chainId: context.chain.id,
		marketId: event.args.id,
		timestamp: event.block.timestamp,
		patch: () => ({ fee: event.args.newFee }),
		isActivity: false,
	});
});
