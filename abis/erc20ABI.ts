export const erc20ABI = [
	{ type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
	{ type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
] as const;

// legacy tokens (e.g. MKR) return bytes32 instead of string
export const erc20Bytes32ABI = [
	{ type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bytes32' }] },
] as const;
