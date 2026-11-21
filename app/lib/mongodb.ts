import { MongoClient, Db } from 'mongodb';

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Please define the MONGODB_URI environment variable in .env');
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('quickbooks_solutions');

  return { client, db };
}

