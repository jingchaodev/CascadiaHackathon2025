import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // model: "gpt-4o-realtime-preview-2025-06-03",
          session: {
            type: "realtime",
            model: "gpt-realtime",
            tools: [
            {
              type: 'mcp',
              server_label: 'langflow',
              require_approval: 'never',
              server_url: 'http://localhost:7860/api/v1/mcp/project/4d8f7027-75b1-40ba-b99f-17984f4ebf21/sse',
              authorization: 'sk-oXzRX8zIGMI0a5svNUliI1i907kz9KVyyrtq6gexN0g'
            },
          ],
          }
        }),
      }
    );
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in /session:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
