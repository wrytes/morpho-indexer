import { type Context } from 'ponder:registry';
import { Address, hexToString } from 'viem';
import { erc20ABI, erc20Bytes32ABI } from '../../abis/erc20ABI';
import { ZERO_ADDRESS } from './derive';

export interface TokenMeta {
	symbol: string;
	decimals: number;
}

/** Best-effort ERC20 metadata. Never throws: a broken token must not stall the indexer. */
export async function readToken(client: Context['client'], address: Address): Promise<TokenMeta> {
	if (address === ZERO_ADDRESS) return { symbol: 'IDLE', decimals: 18 };

	let decimals = 18;
	try {
		decimals = Number(await client.readContract({ abi: erc20ABI, address, functionName: 'decimals' }));
	} catch {}

	let symbol = '?';
	try {
		symbol = await client.readContract({ abi: erc20ABI, address, functionName: 'symbol' });
	} catch {
		try {
			const raw = await client.readContract({ abi: erc20Bytes32ABI, address, functionName: 'symbol' });
			symbol = hexToString(raw, { size: 32 }) || '?';
		} catch {}
	}

	return { symbol: symbol.replace(/\0/g, '').slice(0, 32), decimals };
}
