interface Props { data: any; }
export default function JsonBody({ data }: Props) {
  return <pre className="bg-gray-50 mt-2 p-2 rounded text-xs overflow-x-auto">{JSON.stringify(data, null, 2)}</pre>;
}