interface CourseCardProps {
  title: string;
  description: string;
  price: number;
  isPaid: boolean;
  onBuy: () => void;
  onComplete?: () => void;
}

export function CourseCard({ 
  title, 
  description, 
  price, 
  isPaid, 
  onBuy,
  onComplete 
}: CourseCardProps) {
  return (
    <div className="border rounded-lg p-4 mb-4 bg-white shadow-sm">
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <p className="text-gray-600 mb-4">{description}</p>
      <div className="flex justify-between items-center">
        <span className="text-lg font-bold">{price} TON</span>
        {isPaid ? (
          <button 
            onClick={onComplete}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Завершить
          </button>
        ) : (
          <button 
            onClick={onBuy}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Купить курс
          </button>
        )}
      </div>
    </div>
  );
}