// app/api/items/route.js
import { NextResponse } from 'next/server';
import { validateItem } from '@/app/models/item';
import { connectToDB } from '@/app/lib/db';
import { getToken } from 'next-auth/jwt';

export async function GET(request) {
  try {
    const token = await getToken({ req: request });
    
    if (!token?.sub) {
      return NextResponse.json(
        { error: 'Unauthorized - Missing store context' },
        { status: 401 }
      );
    }

    const { db } = await connectToDB();
    const items = await db
      .collection('items')
      .find(
        { storeId: token.sub },
        { projection: { _id: 0, storeId: 0 } }
      )
      .sort({ lastUpdated: -1 })
      .toArray();
      console.log(items)

    return NextResponse.json(items);

  } catch (err) {
    console.error('GET Error:', err);
    return NextResponse.json(
      { error: 'Failed to load items' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const token = await getToken({ req: request });
    
    if (!token?.sub) {
      return NextResponse.json(
        { error: 'Unauthorized - Missing store context' },
        { status: 401 }
      );
    }

    const { db } = await connectToDB();
    const collection = db.collection('items');
    const body = await request.json();

    // Validate input with storeId
    const validation = validateItem({
      ...body,
      storeId: token.sub
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    // Check for existing SKU within this store
    const exists = await collection.findOne({
      sku: validation.data.sku,
      storeId: token.sub
    });

    if (exists) {
      return NextResponse.json(
        { error: 'SKU already exists in this store' },
        { status: 409 }
      );
    }

    // Insert with validated data
    const result = await collection.insertOne({
      ...validation.data,
      storeId: token.sub,
      lastUpdated: new Date()
    });

    // Return created item without internal IDs
    const createdItem = await collection.findOne(
      { _id: result.insertedId },
      { projection: { _id: 0, storeId: 0 } }
    );

    return NextResponse.json(createdItem, { status: 201 });

  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to create item' },
      { status: 500 }
    );
  }
}