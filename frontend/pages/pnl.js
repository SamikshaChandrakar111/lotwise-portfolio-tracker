import useSWR from "swr";
const fetcher = (url) => fetch(url).then(r=>r.json());
export default function Pnl(){
  const { data } = useSWR(process.env.NEXT_PUBLIC_API_URL + "/pnl", fetcher);
  if (!data) return <div>Loading...</div>;
  return (
    <div>
      <h1>Realized P&L</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
