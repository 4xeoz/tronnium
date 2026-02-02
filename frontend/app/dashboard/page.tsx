export default function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Stats Card 1 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Assets</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">0</p>
        </div>

        {/* Stats Card 2 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Active Scans</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">0</p>
        </div>

        {/* Stats Card 3 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Vulnerabilities</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">0</p>
        </div>
      </div>

      {/* Welcome Section */}
      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Welcome to Tronnium</h2>
        <p className="text-gray-600">
          Get started by adding your first asset or exploring the platform features.
        </p>
      </div>
    </div>
  );
}
