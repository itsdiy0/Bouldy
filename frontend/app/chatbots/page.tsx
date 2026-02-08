import DashboardLayout from "@/components/layout/DashboardLayout";

export default function ChatbotsPage() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold" style={{ color: '#D3DAD9' }}>
          My Chatbots
        </h1>
        <p className="mt-2" style={{ color: '#D3DAD9', opacity: 0.7 }}>
          Your chatbots will appear here...
        </p>
      </div>
    </DashboardLayout>
  );
}