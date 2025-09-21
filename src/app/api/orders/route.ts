import { NextRequest, NextResponse } from 'next/server';
import { fetchOrderById, insertOrder } from '@/server/neonClient';

function missingConfigResponse() {
  return NextResponse.json(
    {
      error: 'NEON_DATABASE_URL is not configured on the server.',
    },
    { status: 500 },
  );
}

export async function POST(request: NextRequest) {
  if (!process.env.NEON_DATABASE_URL) {
    console.error('[orders API][POST] Missing NEON_DATABASE_URL environment variable');
    return missingConfigResponse();
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid JSON payload', details: String(error) },
      { status: 400 },
    );
  }

  const customerName = typeof payload.customerName === 'string' ? payload.customerName.trim() : '';
  const promotionCode =
    typeof payload.promotionCode === 'string' && payload.promotionCode.trim().length > 0
      ? payload.promotionCode.trim()
      : null;
  const items = Array.isArray(payload.items) ? payload.items : [];

  if (!customerName) {
    return NextResponse.json({ error: 'customerName is required' }, { status: 400 });
  }

  if (!items.length) {
    return NextResponse.json({ error: 'items must contain at least one item' }, { status: 400 });
  }

  try {
    const order = await insertOrder({
      customerName,
      promotionCode,
      items: items as Array<{ name: string; quantity: number; notes?: string }>,
    });

    return NextResponse.json(
      {
        order: {
          id: order.id,
          status: order.status,
          createdAt: order.created_at,
          promotionCode: order.promotion_code,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[orders API][POST] Failed to insert order', {
      error: message,
      customerName,
    });
    return NextResponse.json(
      { error: 'Failed to insert order', details: message },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  if (!process.env.NEON_DATABASE_URL) {
    console.error('[orders API][GET] Missing NEON_DATABASE_URL environment variable');
    return missingConfigResponse();
  }

  const { searchParams } = new URL(request.url);
  const orderIdParam = searchParams.get('orderId');

  if (!orderIdParam) {
    return NextResponse.json({ error: 'orderId query parameter is required' }, { status: 400 });
  }

  const orderId = Number.parseInt(orderIdParam, 10);
  if (Number.isNaN(orderId)) {
    return NextResponse.json({ error: 'orderId must be a number' }, { status: 400 });
  }

  try {
    const order = await fetchOrderById(orderId);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const items =
      typeof order.items === 'string'
        ? JSON.parse(order.items)
        : Array.isArray(order.items)
          ? order.items
          : [];

    return NextResponse.json({
      order: {
        id: order.id,
        status: order.status,
        customerName: order.customer_name,
        promotionCode: order.promotion_code,
        createdAt: order.created_at,
        items,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[orders API][GET] Failed to fetch order', {
      error: message,
      orderId,
    });
    return NextResponse.json(
      { error: 'Failed to fetch order', details: message },
      { status: 500 },
    );
  }
}
