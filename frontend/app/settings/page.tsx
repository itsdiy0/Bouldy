import DashboardLayout from "../../components/layout/DashboardLayout";

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold" style={{ color: '#D3DAD9' }}>
          Settings
        </h1>
        <p className="mt-2" style={{ color: '#D3DAD9', opacity: 0.7 }}>
          Settings will go here...
        </p>
      </div>
    </DashboardLayout>
  );
}