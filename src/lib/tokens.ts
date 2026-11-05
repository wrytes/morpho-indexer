import { type Context } from 'ponder:registry';
import { Address, decodeAbiParameters, encodeFunctionData, hexToBigInt, hexToString, type Hex } from 'viem';
import { erc20ABI } from '../../abis/erc20ABI';
import { ZERO_ADDRESS } from './derive';

export interface TokenMeta {
	symbol: string;
	decimals: number;
}

const clean = (s: string) => s.replace(/[\0-\x1f]/g, '').trim().slice(0, 32) || '?';

/** Raw eth_call that never throws (and never makes viem decode, which throws on non-standard tokens). */
async function rawCall(client: Context['client'], to: Address, functionName: 'symbol' | 'decimals'): Promise<Hex | undefined> {
	try {
		const res = await client.call({ to, data: encodeFunctionData({ abi: erc20ABI, functionName }) });
		return res.data && res.data !== '0x' ? res.data : undefined;
	} catch {
		return undefined;
	}
}

/** Handles standard string symbols, legacy bytes32 symbols (MKR, ...) and garbage. */
function decodeSymbol(data: Hex): string {
	try {
		return clean(decodeAbiParameters([{ type: 'string' }], data)[0]);
	} catch {}
	try {
		if (data.length >= 66) return clean(hexToString(`0x${data.slice(2, 66)}`, { size: 32 }));
	} catch {}
	return '?';
}

/** Best-effort ERC20 metadata. Never throws: a broken token must not stall the indexer. */
export async function readToken(client: Context['client'], address: Address): Promise<TokenMeta> {
	if (address === ZERO_ADDRESS) return { symbol: 'IDLE', decimals: 18 };

	const [symData, decData] = await Promise.all([rawCall(client, address, 'symbol'), rawCall(client, address, 'decimals')]);

	let decimals = 18;
	if (decData && decData.length >= 66) {
		const d = hexToBigInt(`0x${decData.slice(2, 66)}`);
		if (d <= 77n) decimals = Number(d);
	}

	return { symbol: symData ? decodeSymbol(symData) : '?', decimals };
}
