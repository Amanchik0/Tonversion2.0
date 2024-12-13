import { useEffect, useState } from 'react';

interface Transaction {
  hash: string;
  time: number;
  value: string;
  from?: string;
  to?: string;
  totalFees: string;
}

export default function ProjectTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('http://localhost:3001/api/wallet/project-transactions');
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }
      const data = await response.json();
      setTransactions(data);
      console.log('Fetched transactions:', data);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

//   useEffect(() => {
//     fetchTransactions();
//     // Обновляем каждые 30 секунд
//     const interval = setInterval(fetchTransactions, 30000);
//     return () => clearInterval(interval);
//   }, []);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatAddress = (address?: string) => {
    if (!address) return 'N/A';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (loading && !transactions.length) {
    return <div className="p-4 text-center">Loading transactions...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        Error: {error}
        <button 
          onClick={fetchTransactions}
          className="ml-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Project Wallet Transactions</h2>
        <button 
          onClick={fetchTransactions}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          disabled={loading}
        >
          {loading ? 'Updating...' : 'Refresh'}
        </button>
      </div>

      <div className="space-y-4">
        {transactions.length > 0 ? (
          transactions.map((tx, index) => (
            <div key={tx.hash || index} className="border rounded-lg p-4 bg-white shadow">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="font-semibold">Time:</div>
                <div>{formatDate(tx.time)}</div>

                <div className="font-semibold">Value:</div>
                <div>{tx.value} TON</div>

                <div className="font-semibold">From:</div>
                <div className="text-gray-600">{formatAddress(tx.from)}</div>

                <div className="font-semibold">To:</div>
                <div className="text-gray-600">{formatAddress(tx.to)}</div>

                <div className="font-semibold">Fee:</div>
                <div>{tx.totalFees} TON</div>

                <div className="font-semibold">Hash:</div>
                <div className="truncate text-gray-600">{tx.hash}</div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            No transactions found
          </div>
        )}
      </div>
    </div>
  );
}