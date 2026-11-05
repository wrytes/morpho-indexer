import { createConfig } from 'ponder';
import { mainnet /*, base */ } from 'viem/chains';
import { Address, http } from 'viem';
import { morphoBlueABI } from './abis/morphoBlueABI';

// Morpho Blue is deployed at the same address on every chain.
// https://docs.morpho.org/get-started/resources/addresses/
const MORPHO_BLUE: Address = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb';

const rpc = (chainId: number, alchemySlug: string) =>
	process.env[`RPC_URL_${chainId}`] || `https://${alchemySlug}.g.alchemy.com/v2/${process.env.ALCHEMY_RPC_KEY}`;

const maxRequestsPerSecond = parseInt(process.env.MAX_REQUESTS_PER_SECOND || '50');
const pollingInterval = parseInt(process.env.POLLING_INTERVAL_MS || '5000');

// Base is disabled for now: uncomment the three `base` blocks (+ import) to re-enable.
// To index another chain: add an entry here, a `chains` entry below and a `morphoBlue.chain` entry.
export const config = {
	[mainnet.id]: {
		rpc: rpc(mainnet.id, 'eth-mainnet'),
		morphoBlue: MORPHO_BLUE,
		startBlock: 18883124, // Morpho Blue deployment block
	},
	// [base.id]: {
	// 	rpc: rpc(base.id, 'base-mainnet'),
	// 	morphoBlue: MORPHO_BLUE,
	// 	startBlock: 13977148, // Morpho Blue deployment block
	// },
};

export default createConfig({
	chains: {
		[mainnet.name]: {
			id: mainnet.id,
			maxRequestsPerSecond,
			pollingInterval,
			rpc: http(config[mainnet.id].rpc),
		},
		// [base.name]: {
		// 	id: base.id,
		// 	maxRequestsPerSecond,
		// 	pollingInterval,
		// 	rpc: http(config[base.id].rpc),
		// },
	},
	contracts: {
		morphoBlue: {
			abi: morphoBlueABI,
			chain: {
				[mainnet.name]: { address: config[mainnet.id].morphoBlue, startBlock: config[mainnet.id].startBlock },
				// [base.name]: { address: config[base.id].morphoBlue, startBlock: config[base.id].startBlock },
			},
		},
	},
});
