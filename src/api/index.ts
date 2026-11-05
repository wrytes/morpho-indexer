import { db } from 'ponder:api';
import schema from 'ponder:schema';
import { Hono } from 'hono';
import { and, asc, client, desc, eq, gte, graphql, lte, sql } from 'ponder';

const app = new Hono();

app.use('/sql/*', client({ db, schema }));
app.use('/', graphql({ db, schema }));
app.use('/graphql', graphql({ db, schema }));

const m = schema.market;

const SORTABLE = {
	supply: m.supplyUnits,
	borrow: m.borrowUnits,
	liquidity: m.liquidityUnits,
	utilization: m.utilization,
	borrowApy: m.borrowApy,
	supplyApy: m.supplyApy,
	lltv: m.lltvPct,
	createdAt: m.createdAt,
	lastActivityAt: m.lastActivityAt,
	liquidations: m.liquidationCount,
	badDebt: m.badDebtAssets,
} as const;

// JSON cannot carry bigint — serialize as decimal strings
const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)), {
		status,
		headers: { 'content-type': 'application/json' },
	});

const isAddress = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);

/**
 * GET /markets — filter all indexed markets.
 *
 * Amounts (supply/borrow/liquidity) are in LOAN TOKEN units (e.g. 1500 = 1500 USDC). Rates/utilization are fractions (0.05 = 5%).
 *
 *   chainId, loan (symbol|address), collateral (symbol|address|idle), oracle, irm
 *   minSupply/maxSupply, minBorrow/maxBorrow, minLiquidity/maxLiquidity
 *   minUtilization/maxUtilization, minBorrowApy/maxBorrowApy, minSupplyApy/maxSupplyApy, minLltv/maxLltv (percent)
 *   activeWithinDays, createdWithinDays, hasBadDebt=true, hasLiquidations=true
 *   sort (see SORTABLE), order (asc|desc), limit (<=1000), offset
 *
 * e.g. cheap-to-borrow, tiny-TVL USDC markets: /markets?loan=USDC&maxSupply=100000&maxBorrowApy=0.02&sort=borrowApy&order=asc
 */
app.get('/markets', async (c) => {
	const q = c.req.query();
	const num = (k: string) => (q[k] !== undefined && q[k] !== '' && Number.isFinite(Number(q[k])) ? Number(q[k]) : undefined);
	const now = Math.floor(Date.now() / 1000);

	const where: (ReturnType<typeof sql> | undefined)[] = [];
	const range = (col: any, min?: number, max?: number) => {
		if (min !== undefined) where.push(gte(col, min));
		if (max !== undefined) where.push(lte(col, max));
	};

	const chainId = num('chainId');
	if (chainId !== undefined) where.push(eq(m.chainId, chainId));

	if (q.loan) where.push(isAddress(q.loan) ? eq(m.loanToken, q.loan.toLowerCase() as `0x${string}`) : eq(sql`lower(${m.loanSymbol})`, q.loan.toLowerCase()));
	if (q.collateral) {
		if (q.collateral === 'idle') where.push(eq(m.collateralSymbol, 'IDLE'));
		else
			where.push(
				isAddress(q.collateral)
					? eq(m.collateralToken, q.collateral.toLowerCase() as `0x${string}`)
					: eq(sql`lower(${m.collateralSymbol})`, q.collateral.toLowerCase())
			);
	}
	if (q.oracle && isAddress(q.oracle)) where.push(eq(m.oracle, q.oracle.toLowerCase() as `0x${string}`));
	if (q.irm && isAddress(q.irm)) where.push(eq(m.irm, q.irm.toLowerCase() as `0x${string}`));

	range(m.supplyUnits, num('minSupply'), num('maxSupply'));
	range(m.borrowUnits, num('minBorrow'), num('maxBorrow'));
	range(m.liquidityUnits, num('minLiquidity'), num('maxLiquidity'));
	range(m.utilization, num('minUtilization'), num('maxUtilization'));
	range(m.borrowApy, num('minBorrowApy'), num('maxBorrowApy'));
	range(m.supplyApy, num('minSupplyApy'), num('maxSupplyApy'));
	range(m.lltvPct, num('minLltv'), num('maxLltv'));

	const activeDays = num('activeWithinDays');
	if (activeDays !== undefined) where.push(gte(m.lastActivityAt, BigInt(now - Math.floor(activeDays * 86400))));
	const createdDays = num('createdWithinDays');
	if (createdDays !== undefined) where.push(gte(m.createdAt, BigInt(now - Math.floor(createdDays * 86400))));
	if (q.hasBadDebt === 'true') where.push(sql`${m.badDebtAssets} > 0`);
	if (q.hasLiquidations === 'true') where.push(sql`${m.liquidationCount} > 0`);

	const sortCol = SORTABLE[(q.sort as keyof typeof SORTABLE) ?? 'supply'] ?? SORTABLE.supply;
	const dir = q.order === 'asc' ? asc : desc;
	const limit = Math.min(Math.max(num('limit') ?? 100, 1), 1000);
	const offset = Math.max(num('offset') ?? 0, 0);

	const rows = await db
		.select()
		.from(m)
		.where(and(...where))
		.orderBy(dir(sortCol), asc(m.id))
		.limit(limit)
		.offset(offset);

	return json({ count: rows.length, limit, offset, markets: rows });
});

app.get('/markets/:chainId/:id', async (c) => {
	const chainId = Number(c.req.param('chainId'));
	const id = c.req.param('id').toLowerCase() as `0x${string}`;
	const [row] = await db.select().from(m).where(and(eq(m.chainId, chainId), eq(m.id, id))).limit(1);
	if (!row) return json({ error: 'market not found' }, 404);

	const days = Math.min(Math.max(Number(c.req.query('days') ?? 90), 1), 3650);
	const history = await db
		.select()
		.from(schema.marketDailyLog)
		.where(and(eq(schema.marketDailyLog.chainId, chainId), eq(schema.marketDailyLog.marketId, id)))
		.orderBy(desc(schema.marketDailyLog.day))
		.limit(days);

	return json({ market: row, history });
});

export default app;
