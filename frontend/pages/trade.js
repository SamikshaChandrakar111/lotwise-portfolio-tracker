import { useState } from "react";
export default function Trade() {
  const [symbol, setSymbol] = useState("AAPL");
  const [qty, setQty] = useState(0);
  const [price, setPrice] = useState(0);

  async function submit(e) {
    e.preventDefault();
    const res = await fetch(process.env.NEXT_PUBLIC_API_URL + "/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, qty: Number(qty), price: Number(price) })
    });
    const data = await res.json();
    alert("Added trade: " + JSON.stringify(data.trade || data));
  }

  return (
    <form onSubmit={submit}>
      <h1>Enter Trade</h1>
      <input value={symbol} onChange={e=>setSymbol(e.target.value)} placeholder="Symbol" />
      <input value={qty} onChange={e=>setQty(e.target.value)} placeholder="Qty (pos buy, neg sell)" />
      <input value={price} onChange={e=>setPrice(e.target.value)} placeholder="Price" />
      <button type="submit">Send</button>
    </form>
  );
}
