export default function Dashboard() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Dashboard Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-sm text-gray-500 font-medium">Net Worth</h2>
          <p className="text-2xl font-semibold text-gray-900 mt-2">$685,957.63</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-sm text-gray-500 font-medium">Cash Flow</h2>
          <p className="text-2xl font-semibold text-green-600 mt-2">+$4,200</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-sm text-gray-500 font-medium">Expenses</h2>
          <p className="text-2xl font-semibold text-red-500 mt-2">-$3,719</p>
        </div>
      </div>
    </div>
  );
}
