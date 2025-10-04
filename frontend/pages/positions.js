import useSWR from "swr";
const fetcher = (url) => fetch(url).then(r=>r.json());
export default function Positions(){
  const { data } = useSWR(process.env.NEXT_PUBLIC_API_URL + "/positions", fetcher);
  if (!data) return <div>Loading...</div>;
  return (
    <div>
      <h1>Open Lots</h1>
      <pre>{JSON.stringify(data.lots, null, 2)}</pre>
      <h2>Aggregated Positions</h2>
      <pre>{JSON.stringify(data.agg, null, 2)}</pre>
    </div>
  );
}
