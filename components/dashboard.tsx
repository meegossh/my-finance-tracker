export default function Dashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard Overview</h1>
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Net Worth</h2>
          <p className="text-2xl font-bold">$685,957.63</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Cash Flow</h2>
          <p className="text-2xl font-bold">+$4,200</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Expenses</h2>
          <p className="text-2xl font-bold">-$3,719</p>
        </div>
      </div>
    </div>
  );
}
