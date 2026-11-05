// Morpho Blue singleton — events only (all that is needed to reconstruct market state)
const marketParams = {
	name: 'marketParams',
	type: 'tuple',
	indexed: false,
	internalType: 'struct MarketParams',
	components: [
		{ name: 'loanToken', type: 'address', internalType: 'address' },
		{ name: 'collateralToken', type: 'address', internalType: 'address' },
		{ name: 'oracle', type: 'address', internalType: 'address' },
		{ name: 'irm', type: 'address', internalType: 'address' },
		{ name: 'lltv', type: 'uint256', internalType: 'uint256' },
	],
} as const;

export const morphoBlueABI = [
	{
		type: 'event',
		name: 'CreateMarket',
		anonymous: false,
		inputs: [{ name: 'id', type: 'bytes32', indexed: true, internalType: 'Id' }, marketParams],
	},
	{
		type: 'event',
		name: 'Supply',
		anonymous: false,
		inputs: [
			{ name: 'id', type: 'bytes32', indexed: true, internalType: 'Id' },
			{ name: 'caller', type: 'address', indexed: true, internalType: 'address' },
			{ name: 'onBehalf', type: 'address', indexed: true, internalType: 'address' },
			{ name: 'assets', type: 'uint256', indexed: false, internalType: 'uint256' },
			{ name: 'shares', type: 'uint256', indexed: false, internalType: 'uint256' },
		],
	},
	{
		type: 'event',
		name: 'Withdraw',
		anonymous: false,
		inputs: [
			{ name: 'id', type: 'bytes32', indexed: true, internalType: 'Id' },
			{ name: 'caller', type: 'address', indexed: false, internalType: 'address' },
			{ name: 'onBehalf', type: 'address', indexed: true, internalType: 'address' },
			{ name: 'receiver', type: 'address', indexed: true, internalType: 'address' },
			{ name: 'assets', type: 'uint256', indexed: false, internalType: 'uint256' },
			{ name: 'shares', type: 'uint256', indexed: false, internalType: 'uint256' },
		],
	},
	{
		type: 'event',
		name: 'Borrow',
		anonymous: false,
		inputs: [
			{ name: 'id', type: 'bytes32', indexed: true, internalType: 'Id' },
			{ name: 'caller', type: 'address', indexed: false, internalType: 'address' },
			{ name: 'onBehalf', type: 'address', indexed: true, internalType: 'address' },
			{ name: 'receiver', type: 'address', indexed: true, internalType: 'address' },
			{ name: 'assets', type: 'uint256', indexed: false, internalType: 'uint256' },
			{ name: 'shares', type: 'uint256', indexed: false, internalType: 'uint256' },
		],
	},
	{
		type: 'event',
		name: 'Repay',
		anonymous: false,
		inputs: [
			{ name: 'id', type: 'bytes32', indexed: true, internalType: 'Id' },
			{ name: 'caller', type: 'address', indexed: true, internalType: 'address' },
			{ name: 'onBehalf', type: 'address', indexed: true, internalType: 'address' },
			{ name: 'assets', type: 'uint256', indexed: false, internalType: 'uint256' },
			{ name: 'shares', type: 'uint256', indexed: false, internalType: 'uint256' },
		],
	},
	{
		type: 'event',
		name: 'SupplyCollateral',
		anonymous: false,
		inputs: [
			{ name: 'id', type: 'bytes32', indexed: true, internalType: 'Id' },
			{ name: 'caller', type: 'address', indexed: true, internalType: 'address' },
			{ name: 'onBehalf', type: 'address', indexed: true, internalType: 'address' },
			{ name: 'assets', type: 'uint256', indexed: false, internalType: 'uint256' },
		],
	},
	{
		type: 'event',
		name: 'WithdrawCollateral',
		anonymous: false,
		inputs: [
			{ name: 'id', type: 'bytes32', indexed: true, internalType: 'Id' },
			{ name: 'caller', type: 'address', indexed: false, internalType: 'address' },
			{ name: 'onBehalf', type: 'address', indexed: true, internalType: 'address' },
			{ name: 'receiver', type: 'address', indexed: true, internalType: 'address' },
			{ name: 'assets', type: 'uint256', indexed: false, internalType: 'uint256' },
		],
	},
	{
		type: 'event',
		name: 'Liquidate',
		anonymous: false,
		inputs: [
			{ name: 'id', type: 'bytes32', indexed: true, internalType: 'Id' },
			{ name: 'caller', type: 'address', indexed: true, internalType: 'address' },
			{ name: 'borrower', type: 'address', indexed: true, internalType: 'address' },
			{ name: 'repaidAssets', type: 'uint256', indexed: false, internalType: 'uint256' },
			{ name: 'repaidShares', type: 'uint256', indexed: false, internalType: 'uint256' },
			{ name: 'seizedAssets', type: 'uint256', indexed: false, internalType: 'uint256' },
			{ name: 'badDebtAssets', type: 'uint256', indexed: false, internalType: 'uint256' },
			{ name: 'badDebtShares', type: 'uint256', indexed: false, internalType: 'uint256' },
		],
	},
	{
		type: 'event',
		name: 'AccrueInterest',
		anonymous: false,
		inputs: [
			{ name: 'id', type: 'bytes32', indexed: true, internalType: 'Id' },
			{ name: 'prevBorrowRate', type: 'uint256', indexed: false, internalType: 'uint256' },
			{ name: 'interest', type: 'uint256', indexed: false, internalType: 'uint256' },
			{ name: 'feeShares', type: 'uint256', indexed: false, internalType: 'uint256' },
		],
	},
	{
		type: 'event',
		name: 'SetFee',
		anonymous: false,
		inputs: [
			{ name: 'id', type: 'bytes32', indexed: true, internalType: 'Id' },
			{ name: 'newFee', type: 'uint256', indexed: false, internalType: 'uint256' },
		],
	},
] as const;
