import { hostedMcpTool } from '@openai/agents';
import { RealtimeAgent, tool } from '@openai/agents/realtime';

const getLatestOrderTool = tool({
  name: 'getLatestOrder',
  description:
    "Fetches the user's most recent DoorDash order, including status, ETA, and restaurant details.",
  parameters: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  execute: async (input: any) => ({
    order_id: 'DD-482913',
    restaurant: 'Tasty Thai Kitchen',
    status: 'Delayed',
    delay_reason: 'Courier stuck in traffic',
    estimated_delivery: 'Delayed ~25 minutes',
    courier_name: 'Jamie',
    subtotal_usd: 28.5,
    items: [
      { name: 'Pad See Ew', quantity: 1 },
      { name: 'Veggie Spring Rolls', quantity: 1 },
    ],
    issue_flags: ['courier-stationary-12-min'],
  }),
});

const getPastOrdersTool = tool({
  name: 'getPastOrders',
  description:
    "Returns a history of previous DoorDash orders to understand the customer's taste preferences.",
  parameters: {
    type: 'object',
    properties: {
      time_range_days: {
        type: 'integer',
        description: 'Optional window (in days) to filter past orders.',
        minimum: 7,
      },
    },
    required: [],
    additionalProperties: false,
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  execute: async (input: any) => ({
    orders: [
      {
        order_id: 'DD-472110',
        restaurant: 'Sakura Sushi',
        order_date: '2024-05-28',
        favorites: ['Spicy Tuna Roll', 'Miso Soup'],
      },
      {
        order_id: 'DD-468902',
        restaurant: 'La Taqueria Feliz',
        order_date: '2024-05-20',
        favorites: ['Al Pastor Tacos', 'Churros'],
      },
      {
        order_id: 'DD-461355',
        restaurant: 'Green Bowl Salads',
        order_date: '2024-05-12',
        favorites: ['Harvest Grain Bowl'],
      },
    ],
  }),
});

const placeOrderTool = tool({
  name: 'placeOrder',
  description:
    'Creates a new DoorDash order using the provided restaurant and item selections.',
  parameters: {
    type: 'object',
    properties: {
      restaurant: {
        type: 'string',
        description: 'Restaurant name or identifier to order from.',
      },
      items: {
        type: 'array',
        description: 'Line items for the order, in the sequence they should be placed.',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Menu item name.',
            },
            quantity: {
              type: 'integer',
              minimum: 1,
              description: 'Quantity requested for the menu item.',
            },
            modifiers: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional list of modifiers or special instructions for the item.',
            },
          },
          required: ['name', 'quantity'],
          additionalProperties: false,
        },
      },
      delivery_instructions: {
        type: 'string',
        description: 'Optional delivery instructions to pass to the courier.',
      },
    },
    required: ['restaurant', 'items'],
    additionalProperties: false,
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  execute: async (input: any) => ({ success: true, order_id: 'DD-493210', eta_minutes: 32 }),
});

const getCustomerAddressTool = tool({
  name: 'getCustomerAddress',
  description: "Retrieves the customer's saved delivery address for DoorDash orders.",
  parameters: {
    type: 'object',
    properties: {
      address_label: {
        type: 'string',
        description: 'Specific label to retrieve (e.g., home, work). Defaults to home.',
        enum: ['home', 'work', 'other'],
      },
    },
    required: [],
    additionalProperties: false,
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  execute: async (input: any) => ({
    label: 'home',
    street: '501 Market St',
    unit: 'Apt 12B',
    city: 'San Francisco',
    state: 'CA',
    zip: '94105',
    delivery_notes: 'Call when arriving, buzzer is 12B.',
  }),
});

const issueRefundTool = tool({
  name: 'issueRefund',
  description:
    "Processes a refund or account credit for the customer's most recent order.",
  parameters: {
    type: 'object',
    properties: {
      order_id: {
        type: 'string',
        description: 'The DoorDash order ID to refund.',
      },
      refund_type: {
        type: 'string',
        enum: ['full', 'partial', 'credit'],
        description: 'Select whether to issue a full refund, partial refund, or credit.',
      },
      amount_usd: {
        type: 'number',
        description: 'Amount to refund if issuing a partial refund or credit.',
      },
      reason: {
        type: 'string',
        description: 'Short explanation for the refund that will be logged for support.',
      },
    },
    required: ['order_id', 'refund_type', 'reason'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { order_id, refund_type, amount_usd } = input as {
      order_id: string;
      refund_type: 'full' | 'partial' | 'credit';
      amount_usd?: number;
    };

    const resolvedAmount =
      refund_type === 'full'
        ? 28.5
        : typeof amount_usd === 'number'
          ? amount_usd
          : 5;

    return {
      order_id,
      refund_type,
      amount_refunded_usd: Number(resolvedAmount.toFixed(2)),
      confirmation_id: 'RF-19822',
      processed_at: new Date().toISOString(),
    };
  },
});

const createReplacementOrderTool = tool({
  name: 'createReplacementOrder',
  description:
    'Places a replacement order tied to the current issue, copying items or specifying updated selections.',
  parameters: {
    type: 'object',
    properties: {
      order_id: {
        type: 'string',
        description: 'The original order that needs a replacement.',
      },
      restaurant: {
        type: 'string',
        description: 'Restaurant to send the replacement order from. Defaults to original order restaurant.',
      },
      items: {
        type: 'array',
        description: 'Replacement items to include in the order.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Menu item name.' },
            quantity: {
              type: 'integer',
              minimum: 1,
              description: 'Quantity requested for this item.',
            },
            modifiers: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional modifiers or notes for the kitchen.',
            },
          },
          required: ['name', 'quantity'],
          additionalProperties: false,
        },
      },
      delivery_instructions: {
        type: 'string',
        description: 'Special delivery instructions for the replacement.',
      },
    },
    required: ['order_id', 'items'],
    additionalProperties: false,
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  execute: async (input: any) => ({
    success: true,
    original_order_id: input.order_id,
    replacement_order_id: 'DD-493987',
    eta_minutes: 28,
  }),
});

export const orderingAgent = new RealtimeAgent({
  name: 'orderingAgent',
  voice: 'alloy',
  handoffDescription:
    'Specialist that manages active orders, creates new orders, and tracks delivery details.',
  instructions:
    "You are the DoorDash ordering specialist. Confirm customer identity, review the latest order status, and place new orders when requested. Make sure you verify delivery address details before confirming any new or replacement order. Summarize key actions back to the user and stay concise.",
  tools: [
    getLatestOrderTool,
    getPastOrdersTool,
    placeOrderTool,
    getCustomerAddressTool,
  ],
  handoffs: [],
});

export const recommendationAgent = new RealtimeAgent({
  name: 'recommendationAgent',
  voice: 'verse',
  handoffDescription:
    'Provides restaurant and menu recommendations based on the customer\'s ordering history.',
  instructions:
    "You are the restaurant recommendation expert. Use past orders to understand taste, surface two or three strong options, and confirm interest before handing back to ordering. Highlight standout dishes and delivery estimates when possible.",
  tools: [getPastOrdersTool, hostedMcpTool({
          serverLabel: 'langflow',
          serverUrl: 'http://localhost:7860/api/v1/mcp/project/4d8f7027-75b1-40ba-b99f-17984f4ebf21/sse',
          allowedTools: ['top_restaurant_search']
        })],
  handoffs: [],
});

export const refundAgent = new RealtimeAgent({
  name: 'refundAgent',
  voice: 'sage',
  handoffDescription:
    'Handles refunds or adjustments when an active order is delayed or has issues.',
  instructions:
    "You manage DoorDash refund requests. Investigate the latest order delay, empathize with the customer, and share the resolution clearly. Use the refund tool when compensation is needed, or trigger a replacement order directly when appropriate. Hand back to ordering when you need them to finalize custom requests.",
  tools: [getLatestOrderTool, issueRefundTool, createReplacementOrderTool],
  handoffs: [],
});

export const conciergeAgent = new RealtimeAgent({
  name: 'conciergeAgent',
  voice: 'sage',
  handoffDescription:
    'Front-line concierge that greets the customer, gathers intent, and routes to the right DoorDash specialist.',
  instructions:
    "You are the DoorDash concierge. Open every conversation with a friendly greeting, confirm how you can help, and collect any essential details before handing the user to Ordering, Recommendations, or Refund support. Keep the handoff summary short but specific so the next agent can act immediately.",
  tools: [hostedMcpTool({
          serverLabel: 'langflow',
          serverUrl: 'http://localhost:7860/api/v1/mcp/project/4d8f7027-75b1-40ba-b99f-17984f4ebf21/sse',
          allowedTools: ['top_restaurant_search']
        })],
  handoffs: [],
});

(conciergeAgent.handoffs as any).push(orderingAgent, recommendationAgent, refundAgent);
(orderingAgent.handoffs as any).push(conciergeAgent, recommendationAgent, refundAgent);
(recommendationAgent.handoffs as any).push(conciergeAgent, orderingAgent);
(refundAgent.handoffs as any).push(conciergeAgent, orderingAgent);

export const doorDashMultiAgentScenario = [
  conciergeAgent,
  orderingAgent,
  recommendationAgent,
  refundAgent,
];

export const doorDashCompanyName = 'DoorDash';
