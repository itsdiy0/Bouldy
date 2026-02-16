export const LLM_PROVIDERS = [
    { 
        id: "openai", 
        name: "OpenAI", 
        models: [
          "gpt-4o", "gpt-4o-mini", 
          "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano",
          "gpt-4-turbo", "gpt-3.5-turbo",
          "o3", "o3-mini", "o4-mini",
        ],
        color: "#10a37f",
        bg: "#10a37f20",
      },
      { 
        id: "anthropic", 
        name: "Anthropic", 
        models: [
          "claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4-5",
          "claude-sonnet-4-20250514", "claude-opus-4-20250514",
          "claude-3-7-sonnet-20250219", "claude-3-5-haiku-20241022",
        ],
        color: "#d4a574",
        bg: "#d4a57420",
      },
      { 
        id: "gemini", 
        name: "Google Gemini", 
        models: [
          "gemini-2.5-flash", "gemini-2.5-pro",
          "gemini-2.0-flash",
          "gemini-3-flash", "gemini-3-pro",
        ],
        color: "#8E75B2",
        bg: "#8E75B220",
      },
      { 
        id: "ollama", 
        name: "Ollama", 
        models: ["llama3", "llama3.1", "llama3.2", "mistral", "codellama", "gemma2", "phi3", "qwen2"],
        color: "#ffffff",
        bg: "#ffffff15",
      },
      { 
        id: "grok", 
        name: "Grok (xAI)", 
        models: ["grok-2", "grok-2-mini", "grok-3", "grok-3-mini"],
        color: "#000000",
        bg: "#ffffff15",
      },
]