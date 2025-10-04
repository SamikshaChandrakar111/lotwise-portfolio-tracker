import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "./db.js"; // ye wahi db.js hai jo maine upar bataya tha

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// ---------------- SCHEMAS -----------------
const tradeSchema = new mongoose.Schema({
  symbol: String,
  qty: Number,
  price: Number,
  processed: { type: Boolean, default: false },
});

const lotSchema = new mongoose.Schema({
  trade_id: mongoose.Schema.Types.ObjectId,
  symbol: String,
  remaining_qty: Number,
  avg_cost: Number,
});

const pnlSchema = new mongoose.Schema({
  symbol: String,
  qty: Number,
  profit: Number,
});

const Trade = mongoose.model("Trade", tradeSchema);
const Lot = mongoose.model("Lot", lotSchema);
const RealizedPNL = mongoose.model("RealizedPNL", pnlSchema);

// ---------------- FUNCTIONS -----------------
async function processTrade(trade) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { _id: tradeId, symbol, qty, price } = trade;

    if (qty > 0) {
      // BUY => create new lot
      await Lot.create([{ trade_id: tradeId, symbol, remaining_qty: qty, avg_cost: price }], { session });
    } else if (qty < 0) {
      // SELL => close lots FIFO
      let toSell = -qty;
      let totalRealized = 0;
      let realizedQty = 0;

      while (toSell > 0) {
        const lot = await Lot.findOne({ symbol, remaining_qty: { $gt: 0 } })
          .sort({ _id: 1 })
          .session(session);

        if (!lot) throw new Error("Not enough shares in open lots to sell (would short-sell)");

        const take = Math.min(lot.remaining_qty, toSell);
        const profit = take * (price - lot.avg_cost);
        totalRealized += profit;
        realizedQty += take;

        lot.remaining_qty -= take;
        await lot.save({ session });

        await RealizedPNL.create([{ symbol, qty: take, profit }], { session });

        toSell -= take;
      }
    }

    trade.processed = true;
    await trade.save({ session });

    await session.commitTransaction();
    session.endSession();

    return { ok: true };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

// ---------------- ROUTES -----------------
app.post("/trades", async (req, res) => {
  const { symbol, qty, price } = req.body;
  if (!symbol || typeof qty !== "number" || typeof price !== "number") {
    return res.status(400).json({ error: "symbol, qty (number), price (number) required" });
  }

  try {
    const trade = await Trade.create({ symbol, qty, price });
    await processTrade(trade);
    res.json({ trade });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/positions", async (req, res) => {
  try {
    const lots = await Lot.find({ remaining_qty: { $gt: 0 } }).sort({ symbol: 1, _id: 1 });

    // Aggregate per symbol
    const agg = await Lot.aggregate([
      { $match: { remaining_qty: { $gt: 0 } } },
      {
        $group: {
          _id: "$symbol",
          qty: { $sum: "$remaining_qty" },
          avg_cost: {
            $avg: "$avg_cost",
          },
        },
      },
    ]);

    res.json({ lots, agg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/pnl", async (req, res) => {
  try {
    const rows = await RealizedPNL.aggregate([
      {
        $group: {
          _id: "$symbol",
          qty: { $sum: "$qty" },
          realized_profit: { $sum: "$profit" },
        },
      },
    ]);

    const totalAgg = await RealizedPNL.aggregate([
      { $group: { _id: null, total: { $sum: "$profit" } } },
    ]);

    const total = totalAgg[0]?.total || 0;

    res.json({ rows, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
