"use client"
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardBody, CardHeader } from "@heroui/react";

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6" style={{ color: '#D3DAD9' }}>
          Dashboard
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card style={{ backgroundColor: '#37353E' }}>
            <CardBody className="p-6">
              <div className="text-4xl mb-2">🤖</div>
              <div className="text-3xl font-bold mb-1" style={{ color: '#D3DAD9' }}>
                0
              </div>
              <p className="text-sm" style={{ color: '#D3DAD9', opacity: 0.7 }}>
                Total Chatbots
              </p>
            </CardBody>
          </Card>

          <Card style={{ backgroundColor: '#37353E' }}>
            <CardBody className="p-6">
              <div className="text-4xl mb-2">📄</div>
              <div className="text-3xl font-bold mb-1" style={{ color: '#D3DAD9' }}>
                0
              </div>
              <p className="text-sm" style={{ color: '#D3DAD9', opacity: 0.7 }}>
                Documents Uploaded
              </p>
            </CardBody>
          </Card>

          <Card style={{ backgroundColor: '#37353E' }}>
            <CardBody className="p-6">
              <div className="text-4xl mb-2">💬</div>
              <div className="text-3xl font-bold mb-1" style={{ color: '#D3DAD9' }}>
                0
              </div>
              <p className="text-sm" style={{ color: '#D3DAD9', opacity: 0.7 }}>
                Conversations
              </p>
            </CardBody>
          </Card>
        </div>

        <Card className="mt-6" style={{ backgroundColor: '#37353E' }}>
          <CardHeader>
            <h2 className="text-xl font-semibold" style={{ color: '#D3DAD9' }}>
              Recent Activity
            </h2>
          </CardHeader>
          <CardBody>
            <p className="text-center py-8" style={{ color: '#D3DAD9', opacity: 0.5 }}>
              No activity yet. Create your first chatbot to get started!
            </p>
          </CardBody>
        </Card>
      </div>
    </DashboardLayout>
  );
}