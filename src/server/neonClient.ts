import { neon } from '@neondatabase/serverless';

if (!process.env.NEON_DATABASE_URL) {
  console.warn(
    '[neonClient] NEON_DATABASE_URL is not set. Neon-backed endpoints will return 500 until it is configured.',
  );
}

const neonSql = process.env.NEON_DATABASE_URL ? neon(process.env.NEON_DATABASE_URL) : null;

function requireNeonClient() {
  if (!neonSql) {
    throw new Error('Neon client unavailable: NEON_DATABASE_URL is not configured');
  }
  return neonSql;
}

export interface NewOrderRecord {
  customerName: string;
  items: Array<{ name: string; quantity: number; notes?: string }>;
  promotionCode?: string | null;
}

export async function insertOrder(payload: NewOrderRecord) {
  const client = requireNeonClient();
  const { customerName, items, promotionCode } = payload;

  try {
    const [row] = await client<{
      id: number;
      status: string;
      created_at: string;
      promotion_code: string | null;
    }>`
      INSERT INTO doordash_orders (customer_name, items, promotion_code, status)
      VALUES (${customerName}, ${JSON.stringify(items)}, ${promotionCode ?? null}, 'pending')
      RETURNING id, status, created_at, promotion_code;
    `;

    return row;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[neonClient] insertOrder failed', {
      error: message,
      customerName,
    });
    throw error;
  }
}

export async function fetchOrderById(orderId: number) {
  const client = requireNeonClient();

  try {
    const [row] = await client<
      | {
          id: number;
          status: string;
          customer_name: string;
          promotion_code: string | null;
          created_at: string;
          items: unknown;
        }
      | undefined
    >`
      SELECT id, status, customer_name, promotion_code, created_at, items
      FROM doordash_orders
      WHERE id = ${orderId}
      LIMIT 1;
    `;

    return row ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[neonClient] fetchOrderById failed', {
      error: message,
      orderId,
    });
    throw error;
  }
}
