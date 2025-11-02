import DashboardLayout from "../components/layout/DashboardLayout";

export default function CreatePage() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold" style={{ color: '#D3DAD9' }}>
          Create New Chatbot
        </h1>
        <p className="mt-2" style={{ color: '#D3DAD9', opacity: 0.7 }}>
          Wizard will go here...
        </p>
      </div>
    </DashboardLayout>
  );
}