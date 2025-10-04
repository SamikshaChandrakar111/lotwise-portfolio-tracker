import express from "express";
import cors from "cors";
import pool from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

/** helper: process a trade synchronously (BUY = create lot, SELL = close lots FIFO) */
async function processTrade(trade) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { id: tradeId, symbol, qty, price } = trade;

    if (qty > 0) {
      // BUY -> new lot
      await client.query(
        `INSERT INTO lots (trade_id, symbol, remaining_qty, avg_cost) VALUES ($1,$2,$3,$4)`,
        [tradeId, symbol, qty, price]
      );
    } else if (qty < 0) {
      // SELL -> close lots FIFO
      let toSell = -qty; // positive number
      let totalRealized = 0;
      let realizedQty = 0;

      while (toSell > 0) {
        // pick first open lot (FIFO) for this symbol
        const lotRes = await client.query(
          `SELECT id, remaining_qty, avg_cost FROM lots
           WHERE symbol = $1 AND remaining_qty > 0
           ORDER BY id ASC
           LIMIT 1
           FOR UPDATE`,
          [symbol]
        );

        if (lotRes.rows.length === 0) {
          throw new Error("Not enough shares in open lots to sell (would short-sell)");
        }

        const lot = lotRes.rows[0];
        const take = Math.min(lot.remaining_qty, toSell);
        const profit = take * (price - parseFloat(lot.avg_cost));
        totalRealized += profit;
        realizedQty += take;

        // update lot remaining
        const newRemaining = lot.remaining_qty - take;
        await client.query(
          `UPDATE lots SET remaining_qty = $1 WHERE id = $2`,
          [newRemaining, lot.id]
        );

        // insert realized_pnl row for this piece
        await client.query(
          `INSERT INTO realized_pnl (symbol, qty, profit) VALUES ($1, $2, $3)`,
          [symbol, take, profit]
        );

        toSell -= take;
      }
    }

    // mark trade processed (optional)
    await client.query(`UPDATE trades SET processed = TRUE WHERE id = $1`, [tradeId]);

    await client.query("COMMIT");
    return { ok: true };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** API: add trade */
app.post("/trades", async (req, res) => {
  const { symbol, qty, price } = req.body;
  if (!symbol || typeof qty !== "number" || typeof price !== "number") {
    return res.status(400).json({ error: "symbol, qty (number), price (number) required" });
  }

  try {
    const insert = await pool.query(
      `INSERT INTO trades (symbol, qty, price) VALUES ($1,$2,$3) RETURNING *`,
      [symbol, qty, price]
    );
    const trade = insert.rows[0];

    // Immediately process (for demo). In Kafka approach you'd publish an event instead.
    await processTrade(trade);

    res.json({ trade });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/** GET /positions => return open lots + per-symbol aggregated avg cost */
app.get("/positions", async (req, res) => {
  try {
    const lots = (await pool.query(`SELECT * FROM lots WHERE remaining_qty > 0 ORDER BY symbol, id`)).rows;
    const agg = (await pool.query(
      `SELECT symbol, SUM(remaining_qty) AS qty,
        CASE WHEN SUM(remaining_qty)=0 THEN 0 ELSE SUM(remaining_qty*avg_cost)/SUM(remaining_qty) END AS avg_cost
       FROM lots WHERE remaining_qty > 0 GROUP BY symbol`
    )).rows;
    res.json({ lots, agg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /pnl => realized P&L summary per symbol and total */
app.get("/pnl", async (req, res) => {
  try {
    const rows = (await pool.query(
      `SELECT symbol, SUM(qty) AS qty, SUM(profit) AS realized_profit
       FROM realized_pnl GROUP BY symbol`
    )).rows;

    const total = (await pool.query(`SELECT SUM(profit) AS total FROM realized_pnl`)).rows[0].total || 0;
    res.json({ rows, total: parseFloat(total) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
