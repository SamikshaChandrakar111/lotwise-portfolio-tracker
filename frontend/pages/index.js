import Link from "next/link";

export default function Home() {
  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>📊 Lotwise Portfolio Tracker</h1>
      <p>Welcome! Use the links below to navigate:</p>
      <ul>
        <li><Link href="/trade">➡️ Add Trade</Link></li>
        <li><Link href="/positions">➡️ View Open Positions</Link></li>
        <li><Link href="/pnl">➡️ View Realized P&amp;L</Link></li>
      </ul>
    </div>
  );
}
