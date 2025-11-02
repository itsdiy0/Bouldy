"use client";

import { useState, useEffect } from "react";
import { Button, Card, CardBody, CardHeader } from "@heroui/react";

export default function Home() {
  const [isDark, setIsDark] = useState(true);
  
  useEffect(() => {
    // Set dark mode on mount
    document.documentElement.classList.add('dark');
  }, []);
  
  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
    setIsDark(!isDark);
  };

  return (
    <main 
      className="min-h-screen p-8 transition-colors duration-300"
      style={{ 
        backgroundColor: isDark ? '#44444E' : '#D3DAD9' 
      }}
    >
      {/* Theme Toggle Button */}
      <Button 
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-50"
        style={{ 
          backgroundColor: '#715A5A', 
          color: '#D3DAD9' 
        }}
      >
        {isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
      </Button>
      
      {/* Main Content */}
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Hero Section */}
        <div className="text-center space-y-4 py-8">
          <h1 
            className="text-6xl font-bold"
            style={{ color: isDark ? '#D3DAD9' : '#37353E' }}
          >
            🪨 Bouldy
          </h1>
          <p 
            className="text-xl"
            style={{ 
              color: isDark ? '#D3DAD9' : '#37353E',
              opacity: 0.85 
            }}
          >
            Your steadfast companion for document knowledge
          </p>
          <p 
            className="text-sm"
            style={{ 
              color: isDark ? '#D3DAD9' : '#37353E',
              opacity: 0.6 
            }}
          >
            Create custom AI chatbots from your documents
          </p>
        </div>

        {/* Main CTA Card */}
        <Card 
          className="shadow-xl"
          style={{ 
            backgroundColor: isDark ? '#37353E' : '#FFFFFF',
            border: `1px solid ${isDark ? '#715A5A' : '#44444E'}40`
          }}
        >
          <CardHeader className="flex-col items-start px-6 pt-6">
            <h2 
              className="text-2xl font-semibold"
              style={{ color: isDark ? '#D3DAD9' : '#37353E' }}
            >
              Build AI-Powered Chatbots
            </h2>
            <p 
              className="text-sm mt-2"
              style={{ 
                color: isDark ? '#D3DAD9' : '#37353E',
                opacity: 0.7 
              }}
            >
              Upload documents, create chatbots, and deploy them anywhere
            </p>
          </CardHeader>
          <CardBody className="px-6 pb-6">
            <div className="flex gap-4">
              <Button 
                size="lg"
                className="font-medium"
                style={{ 
                  backgroundColor: '#715A5A', 
                  color: '#D3DAD9' 
                }}
              >
                Get Started
              </Button>
              <Button 
                variant="bordered" 
                size="lg"
                className="font-medium"
                style={{ 
                  borderColor: '#715A5A',
                  borderWidth: '2px',
                  color: isDark ? '#D3DAD9' : '#37353E',
                  backgroundColor: 'transparent'
                }}
              >
                Learn More
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <Card 
            className="shadow-lg"
            style={{ backgroundColor: isDark ? '#37353E' : '#FFFFFF' }}
          >
            <CardBody className="p-6 text-center">
              <div className="text-5xl mb-3">📄</div>
              <h3 
                className="font-semibold text-lg mb-2"
                style={{ color: isDark ? '#D3DAD9' : '#37353E' }}
              >
                Upload Documents
              </h3>
              <p 
                className="text-sm"
                style={{ 
                  color: isDark ? '#D3DAD9' : '#37353E',
                  opacity: 0.6 
                }}
              >
                PDF, DOCX, and TXT supported
              </p>
            </CardBody>
          </Card>

          <Card 
            className="shadow-lg"
            style={{ backgroundColor: isDark ? '#37353E' : '#FFFFFF' }}
          >
            <CardBody className="p-6 text-center">
              <div className="text-5xl mb-3">🤖</div>
              <h3 
                className="font-semibold text-lg mb-2"
                style={{ color: isDark ? '#D3DAD9' : '#37353E' }}
              >
                Create Chatbots
              </h3>
              <p 
                className="text-sm"
                style={{ 
                  color: isDark ? '#D3DAD9' : '#37353E',
                  opacity: 0.6 
                }}
              >
                Train on your specific documents
              </p>
            </CardBody>
          </Card>

          <Card 
            className="shadow-lg"
            style={{ backgroundColor: isDark ? '#37353E' : '#FFFFFF' }}
          >
            <CardBody className="p-6 text-center">
              <div className="text-5xl mb-3">🚀</div>
              <h3 
                className="font-semibold text-lg mb-2"
                style={{ color: isDark ? '#D3DAD9' : '#37353E' }}
              >
                Deploy Anywhere
              </h3>
              <p 
                className="text-sm"
                style={{ 
                  color: isDark ? '#D3DAD9' : '#37353E',
                  opacity: 0.6 
                }}
              >
                Embeddable widgets and shareable links
              </p>
            </CardBody>
          </Card>
        </div>

        {/* How It Works Section */}
        <Card 
          className="shadow-xl mt-8"
          style={{ 
            backgroundColor: isDark ? '#37353E' : '#FFFFFF',
            border: `1px solid #715A5A40`
          }}
        >
          <CardHeader className="px-6 pt-6">
            <h2 
              className="text-2xl font-semibold"
              style={{ color: isDark ? '#D3DAD9' : '#37353E' }}
            >
              How It Works
            </h2>
          </CardHeader>
          <CardBody className="px-6 pb-6">
            <div className="space-y-4">
              <div className="flex gap-4 items-start">
                <div 
                  className="text-2xl font-bold rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0"
                  style={{ 
                    backgroundColor: '#715A5A',
                    color: '#D3DAD9'
                  }}
                >
                  1
                </div>
                <div>
                  <h4 
                    className="font-semibold mb-1"
                    style={{ color: isDark ? '#D3DAD9' : '#37353E' }}
                  >
                    Upload Your Documents
                  </h4>
                  <p 
                    className="text-sm"
                    style={{ 
                      color: isDark ? '#D3DAD9' : '#37353E',
                      opacity: 0.7 
                    }}
                  >
                    Drop in your PDFs, Word docs, or text files
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div 
                  className="text-2xl font-bold rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0"
                  style={{ 
                    backgroundColor: '#715A5A',
                    color: '#D3DAD9'
                  }}
                >
                  2
                </div>
                <div>
                  <h4 
                    className="font-semibold mb-1"
                    style={{ color: isDark ? '#D3DAD9' : '#37353E' }}
                  >
                    Create Your Chatbot
                  </h4>
                  <p 
                    className="text-sm"
                    style={{ 
                      color: isDark ? '#D3DAD9' : '#37353E',
                      opacity: 0.7 
                    }}
                  >
                    Select documents, configure your LLM, customize behavior
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div 
                  className="text-2xl font-bold rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0"
                  style={{ 
                    backgroundColor: '#715A5A',
                    color: '#D3DAD9'
                  }}
                >
                  3
                </div>
                <div>
                  <h4 
                    className="font-semibold mb-1"
                    style={{ color: isDark ? '#D3DAD9' : '#37353E' }}
                  >
                    Deploy & Share
                  </h4>
                  <p 
                    className="text-sm"
                    style={{ 
                      color: isDark ? '#D3DAD9' : '#37353E',
                      opacity: 0.7 
                    }}
                  >
                    Embed on your website or share a public link
                  </p>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}