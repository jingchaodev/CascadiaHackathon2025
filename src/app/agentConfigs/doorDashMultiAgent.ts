import { hostedMcpTool } from '@openai/agents';
import { RealtimeAgent, tool } from '@openai/agents/realtime';

const getApiBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  return 'http://localhost:3000';
};

const fetchOrderHistoryTool = tool({
  name: 'fetchOrderHistory',
  description:
    "Retrieves recent DoorDash orders from the order database to understand the customer's taste preferences.",
  parameters: {
    type: 'object',
    properties: {
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        description: 'Maximum number of historical orders to retrieve. Defaults to 25.',
      },
    },
    required: [],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    try {
      const params = new URLSearchParams();
      if (typeof input.limit === 'number') {
        params.set('limit', String(input.limit));
      }

      const url = `${getApiBaseUrl()}/api/orders${params.size ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        let errorBody: any = {};
        try {
          errorBody = await response.clone().json();
        } catch {
          const text = await response.text().catch(() => '');
          if (text) {
            errorBody = { error: text };
          }
        }
        console.error('[fetchOrderHistoryTool] Database fetch failed', {
          status: response.status,
          error: errorBody.error,
        });
        return {
          success: false,
          error: errorBody.error ?? 'Failed to fetch order history',
          details: errorBody.details,
        };
      }

      const { orders } = await response.json();
      return {
        success: true,
        orders,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[fetchOrderHistoryTool] Unexpected error', { error: message });
      return {
        success: false,
        error: 'Unexpected failure while fetching order history',
        details: message,
      };
    }
  },
});

const createOrderRecordTool = tool({
  name: 'createOrderRecord',
  description:
    'Persists an order record in the order database and returns its identifier and status.',
  parameters: {
    type: 'object',
    properties: {
      customer_name: {
        type: 'string',
        description: 'Name to associate with the order record.',
      },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            quantity: { type: 'integer', minimum: 1 },
            notes: { type: 'string' },
          },
          required: ['name', 'quantity'],
          additionalProperties: false,
        },
        description: 'Items to persist with the order.',
      },
      promotion_code: {
        type: 'string',
        description: 'Optional promotion code applied to the order.',
      },
    },
    required: ['customer_name', 'items'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: input.customer_name,
          items: input.items,
          promotionCode: input.promotion_code,
        }),
      });

      if (!response.ok) {
        let errorBody: any = {};
        try {
          errorBody = await response.clone().json();
        } catch {
          const text = await response.text().catch(() => '');
          if (text) {
            errorBody = { error: text };
          }
        }
        console.error('[createOrderRecordTool] Database insert failed', {
          status: response.status,
          error: errorBody.error,
        });
        return {
          success: false,
          error: errorBody.error ?? 'Failed to store order record',
          details: errorBody.details,
        };
      }

      const { order } = await response.json();
      return {
        success: true,
        order,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[createOrderRecordTool] Unexpected error', { error: message });
      return {
        success: false,
        error: 'Unexpected failure while storing order record',
        details: message,
      };
    }
  },
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
    street: '1700 Westlake Ave N',
    unit: 'Suite #200',
    city: 'Seattle',
    state: 'WA',
    zip: '98109',
    delivery_notes: 'Call when arriving, buzzer is 12B.',
  }),
});

const fetchOrderRecordTool = tool({
  name: 'fetchOrderRecord',
  description: 'Fetches an order record by id and returns the latest stored details.',
  parameters: {
    type: 'object',
    properties: {
      order_id: {
        type: 'integer',
        description: 'Identifier returned when the order record was created.',
      },
    },
    required: ['order_id'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/orders?orderId=${input.order_id}`);

      if (!response.ok) {
        let errorBody: any = {};
        try {
          errorBody = await response.clone().json();
        } catch {
          const text = await response.text().catch(() => '');
          if (text) {
            errorBody = { error: text };
          }
        }
        console.error('[fetchOrderRecordTool] Database fetch failed', {
          status: response.status,
          error: errorBody.error,
        });
        return {
          success: false,
          error: errorBody.error ?? 'Failed to fetch order record',
          details: errorBody.details,
        };
      }

      const { order } = await response.json();
      return {
        success: true,
        order,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[fetchOrderRecordTool] Unexpected error', { error: message });
      return {
        success: false,
        error: 'Unexpected failure while fetching order record',
        details: message,
      };
    }
  },
});

const fetchNearbyRestaurantsTool = tool({
  name: 'fetchNearbyRestaurants',
  description:
    'Looks up nearby restaurants for the user based on location, cuisine, and delivery radius.',
  parameters: {
    type: 'object',
    properties: {
      latitude: {
        type: 'number',
        description:
          'Latitude of the user or delivery address. When omitted, defaults to Thinkspace (1700 Westlake Ave N, Seattle).',
      },
      longitude: {
        type: 'number',
        description:
          'Longitude of the user or delivery address. Must be provided when latitude is supplied.',
      },
      radius_miles: {
        type: 'number',
        description: 'Optional search radius in miles. Defaults to 3 miles.',
        minimum: 0.5,
        maximum: 15,
      },
      cuisine: {
        type: 'string',
        description: 'Optional cuisine filter (e.g. Thai, Mexican, Sushi).',
      },
      limit: {
        type: 'integer',
        description: 'Optional maximum number of restaurants to return. Defaults to 5.',
        minimum: 1,
        maximum: 20,
      },
    },
    required: [],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    try {
      const params = new URLSearchParams();
      if (typeof input.latitude === 'number' && typeof input.longitude === 'number') {
        params.set('latitude', String(input.latitude));
        params.set('longitude', String(input.longitude));
      }
      if (typeof input.radius_miles === 'number') {
        params.set('radiusMiles', String(input.radius_miles));
      }
      if (typeof input.cuisine === 'string' && input.cuisine.trim().length > 0) {
        params.set('cuisine', input.cuisine.trim());
      }
      if (typeof input.limit === 'number') {
        params.set('limit', String(input.limit));
      }

      const url = `${getApiBaseUrl()}/api/restaurants${params.size ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        let errorBody: any = {};
        try {
          errorBody = await response.clone().json();
        } catch {
          const text = await response.text().catch(() => '');
          if (text) {
            errorBody = { error: text };
          }
        }
        console.error('[fetchNearbyRestaurantsTool] Restaurant lookup failed', {
          status: response.status,
          error: errorBody.error,
        });
        return {
          success: false,
          error: errorBody.error ?? 'Failed to fetch nearby restaurants',
          details: errorBody.details,
        };
      }

      const { restaurants } = await response.json();
      return {
        success: true,
        restaurants,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[fetchNearbyRestaurantsTool] Unexpected error', { error: message });
      return {
        success: false,
        error: 'Unexpected failure while fetching nearby restaurants',
        details: message,
      };
    }
  },
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

const getActivePromotionsTool = tool({
  name: 'getActivePromotions',
  description:
    'Retrieves current restaurant promotions and limited-time discounts tailored to the customer.',
  parameters: {
    type: 'object',
    properties: {
      cuisine_filter: {
        type: 'string',
        description: 'Optional cuisine filter for targeted promotion results.',
      },
      include_expiring: {
        type: 'boolean',
        description: 'Include deals expiring in the next two hours when set to true.',
      },
    },
    required: [],
    additionalProperties: false,
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  execute: async (input: any) => ({
    promotions: [
      {
        promotion_id: 'PROMO-BOGO-NAAN',
        title: 'Buy One Get One Curry',
        restaurant: 'Masala Garden',
        discount_summary: 'BOGO on entrees, up to $15 value',
        expires_at: '2024-06-08T21:00:00Z',
        highlighted_items: ['Paneer Tikka Masala', 'Garlic Naan'],
      },
      {
        promotion_id: 'PROMO-20-GREENS',
        title: '20% Off Healthy Bowls',
        restaurant: 'Green Bowl Salads',
        discount_summary: '20% off orders over $25',
        expires_at: '2024-06-10T05:00:00Z',
        highlighted_items: ['Harvest Grain Bowl', 'Citrus Quinoa Bowl'],
      },
      {
        promotion_id: 'PROMO-LATE-NIGHT',
        title: 'Late Night Sushi Combo',
        restaurant: 'Sakura Sushi',
        discount_summary: '$8 off combo rolls after 8pm',
        expires_at: '2024-06-09T06:00:00Z',
        highlighted_items: ['Spicy Tuna Roll', 'Dragon Roll'],
      },
    ],
  }),
});

const applyPromotionCodeTool = tool({
  name: 'applyPromotionCode',
  description:
    'Applies a selected promotion to the user\'s active or upcoming order and returns the updated totals.',
  parameters: {
    type: 'object',
    properties: {
      order_id: {
        type: 'string',
        description: 'Order ID to apply the promotion to. Defaults to the latest order when omitted.',
      },
      promotion_code: {
        type: 'string',
        description: 'Promotion code or identifier to apply.',
      },
    },
    required: ['promotion_code'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { order_id, promotion_code } = input as {
      order_id?: string;
      promotion_code: string;
    };

    return {
      order_id: order_id ?? 'DD-482913',
      promotion_code,
      discount_applied_usd: 7.5,
      new_subtotal_usd: 21.0,
      confirmation_id: 'PROMO-APPLIED-9921',
    };
  },
});

export const orderingAgent = new RealtimeAgent({
  name: 'orderingAgent',
  voice: 'alloy',
  handoffDescription:
    'Specialist that manages active orders, creates new orders, and tracks delivery details.',
  instructions:
    "You are the DoorDash ordering specialist. Confirm customer identity, review the latest order status, and place new orders when requested. Make sure you verify delivery address details before confirming any new or replacement order. Summarize key actions back to the user and stay concise.",
  tools: [
    fetchOrderHistoryTool,
    getCustomerAddressTool,
    applyPromotionCodeTool,
    createOrderRecordTool,
    fetchOrderRecordTool,
  ],
  handoffs: [],
});

export const recommendationAgent = new RealtimeAgent({
  name: 'recommendationAgent',
  voice: 'verse',
  handoffDescription:
    'Provides restaurant and menu recommendations based on the customer\'s ordering history.',
  instructions:
    "You are the restaurant recommendation expert. Use past orders to understand taste, spotlight any active promotions that fit, surface two or three strong options, and confirm interest before handing back to ordering. Highlight standout dishes and delivery estimates when possible.",
  tools: [fetchOrderHistoryTool, getActivePromotionsTool, fetchNearbyRestaurantsTool, hostedMcpTool({
          serverLabel: 'langflow',
          serverUrl: 'http://localhost:7860/api/v1/mcp/project/4d8f7027-75b1-40ba-b99f-17984f4ebf21/sse',
          allowedTools: ['top_restaurant_search']
        })],
  handoffs: [],
});

export const promoAgent = new RealtimeAgent({
  name: 'promoAgent',
  voice: 'spark',
  handoffDescription:
    'Surfaces limited-time DoorDash deals, bundle specials, and applies the right promo codes.',
  instructions:
    "You are the promotions concierge. Match the customer’s cravings with active deals, call out savings clearly, and coordinate with ordering to apply discounts. Verify any promo code details before confirming the plan.",
  tools: [getActivePromotionsTool, applyPromotionCodeTool],
  handoffs: [],
});

export const refundAgent = new RealtimeAgent({
  name: 'refundAgent',
  voice: 'sage',
  handoffDescription:
    'Handles refunds or adjustments when an active order is delayed or has issues.',
  instructions:
    "You manage DoorDash refund requests. Investigate the latest order delay, empathize with the customer, and share the resolution clearly. Use the refund tool when compensation is needed, or trigger a replacement order directly when appropriate. Hand back to ordering when you need them to finalize custom requests.",
  tools: [fetchOrderRecordTool, issueRefundTool, createReplacementOrderTool],
  handoffs: [],
});

export const conciergeAgent = new RealtimeAgent({
  name: 'conciergeAgent',
  voice: 'sage',
  handoffDescription:
    'Front-line concierge that greets the customer, gathers intent, and routes to the right DoorDash specialist.',
  instructions:
    "You are the DoorDash concierge. Open every conversation with a friendly greeting, confirm how you can help, and collect any essential details before handing the user to Ordering, Promotions, Recommendations, or Refund support. Keep the handoff summary short but specific so the next agent can act immediately.",
  tools: [hostedMcpTool({
          serverLabel: 'langflow',
          serverUrl: 'http://localhost:7860/api/v1/mcp/project/4d8f7027-75b1-40ba-b99f-17984f4ebf21/sse',
          allowedTools: ['top_restaurant_search']
        })],
  handoffs: [],
});

(conciergeAgent.handoffs as any).push(orderingAgent, recommendationAgent, refundAgent, promoAgent);
(orderingAgent.handoffs as any).push(conciergeAgent, recommendationAgent, refundAgent, promoAgent);
(recommendationAgent.handoffs as any).push(conciergeAgent, orderingAgent, promoAgent);
(promoAgent.handoffs as any).push(conciergeAgent, orderingAgent, recommendationAgent);
(refundAgent.handoffs as any).push(conciergeAgent, orderingAgent, promoAgent);

export const doorDashMultiAgentScenario = [
  conciergeAgent,
  orderingAgent,
  recommendationAgent,
  promoAgent,
  refundAgent,
];

export const doorDashCompanyName = 'DoorDash';
