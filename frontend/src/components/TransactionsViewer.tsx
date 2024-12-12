import { useState, useEffect } from 'react';

interface Transaction {
  hash: string;
  time: number;
  value: string;
  from?: string;
  to?: string;
  lt?: string;
  totalFees?: string;
  storageFee?: string;
  otherFee?: string;
  description?: string;
}

export default function TransactionsViewer({ 
  projectAddress, 
  userAddress 
}: { 
  projectAddress: string;
  userAddress: string;
}) {
  const [projectTxs, setProjectTxs] = useState<Transaction[]>([]);
  const [userTxs, setUserTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const fetchTransactions = async () => {
    setLoading(true);
    setError('');
    try {
      const [projectResponse, userResponse] = await Promise.all([
        fetch(`http://localhost:3001/api/wallet/transactions/${projectAddress}`),
        fetch(`http://localhost:3001/api/wallet/transactions/${userAddress}`)
      ]);

      if (!projectResponse.ok || !userResponse.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const projectData = await projectResponse.json();
      const userData = await userResponse.json();

      console.log('Project transactions:', projectData);
      console.log('User transactions:', userData);

      setProjectTxs(projectData);
      setUserTxs(userData);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setError('Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectAddress && userAddress) {
      fetchTransactions();
    }
  }, [projectAddress, userAddress]);

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatAddress = (address?: string) => {
    if (!address) return 'N/A';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatTON = (value: string) => {
    return `${parseFloat(value).toFixed(9)} TON`;
  };

  const renderTransaction = (tx: Transaction) => (
    <div className="border p-3 rounded-lg bg-white shadow-sm">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="font-semibold">Hash:</div>
        <div className="break-all">{tx.hash}</div>
        
        <div className="font-semibold">Time:</div>
        <div>{formatDate(tx.time)}</div>
        
        <div className="font-semibold">Value:</div>
        <div>{formatTON(tx.value)}</div>
        
        <div className="font-semibold">From:</div>
        <div>{formatAddress(tx.from)}</div>
        
        <div className="font-semibold">To:</div>
        <div>{formatAddress(tx.to)}</div>

        {tx.lt && (
          <>
            <div className="font-semibold">LT:</div>
            <div>{tx.lt}</div>
          </>
        )}

        {tx.totalFees && (
          <>
            <div className="font-semibold">Total Fees:</div>
            <div>{formatTON(tx.totalFees)}</div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-2xl space-y-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

        <h3 className="text-lg font-bold mb-4">Транзакции проекта ({projectTxs.length})</h3>
        {loading ? (
          <div className="text-center py-4">Загрузка...</div>
        ) : projectTxs.length > 0 ? (
          <div className="space-y-3">
            {projectTxs.map((tx, index) => (
              <div key={index}>{renderTransaction(tx)}</div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">Нет транзакций</div>
        )}
  
        <h3 className="text-lg font-bold mb-4">Транзакции пользователя ({userTxs.length})</h3>
        {loading ? (
          <div className="text-center py-4">Загрузка...</div>
        ) : userTxs.length > 0 ? (
          <div className="space-y-3">
            {userTxs.map((tx, index) => (
              <div key={index}>{renderTransaction(tx)}</div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">Нет транзакций</div>
        )}

      <button 
        onClick={fetchTransactions}
        className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
        disabled={loading}
      >
        {loading ? 'Загрузка...' : 'Обновить транзакции'}
      </button>
    </div>
  );
}