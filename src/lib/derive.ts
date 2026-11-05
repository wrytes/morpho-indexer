const WAD = 10n ** 18n;
const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const zeroFloorSub = (a: bigint, b: bigint) => (a > b ? a - b : 0n);

const wadToNumber = (x: bigint) => Number(x) / 1e18;
const toUnits = (x: bigint, decimals: number) => Number(x) / 10 ** decimals;

interface DeriveInput {
	totalSupplyAssets: bigint;
	totalBorrowAssets: bigint;
	totalCollateral: bigint;
	lastBorrowRate: bigint;
	fee: bigint;
	loanDecimals: number;
	collateralDecimals: number;
}

/** Derived, human-readable columns. APYs are fractions (0.05 = 5%). */
export function deriveMarket(m: DeriveInput) {
	const utilization = m.totalSupplyAssets === 0n ? 0 : wadToNumber((m.totalBorrowAssets * WAD) / m.totalSupplyAssets);
	const borrowApr = wadToNumber(m.lastBorrowRate) * SECONDS_PER_YEAR;
	const borrowApy = Math.expm1(borrowApr);
	// suppliers receive borrow interest scaled by utilization, minus the protocol fee
	const supplyApy = Math.expm1(borrowApr * utilization * (1 - wadToNumber(m.fee)));

	return {
		supplyUnits: toUnits(m.totalSupplyAssets, m.loanDecimals),
		borrowUnits: toUnits(m.totalBorrowAssets, m.loanDecimals),
		liquidityUnits: toUnits(zeroFloorSub(m.totalSupplyAssets, m.totalBorrowAssets), m.loanDecimals),
		collateralUnits: toUnits(m.totalCollateral, m.collateralDecimals),
		utilization,
		borrowApy,
		supplyApy,
	};
}

export const lltvToPct = (lltv: bigint) => wadToNumber(lltv) * 100;
