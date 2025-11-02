import DashboardLayout from "../components/layout/DashboardLayout";

export default function DocumentsPage() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold" style={{ color: '#D3DAD9' }}>
          Documents
        </h1>
        <p className="mt-2" style={{ color: '#D3DAD9', opacity: 0.7 }}>
        Documents will go here...
        </p>
      </div>
    </DashboardLayout>
  );
}