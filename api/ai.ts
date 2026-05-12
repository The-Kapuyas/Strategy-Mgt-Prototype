import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { model, messages, temperature, max_tokens, response_format } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  try {
    const response = await client.chat.completions.create({
      model: model || 'gpt-4o',
      messages,
      temperature: temperature ?? 0.7,
      ...(max_tokens && { max_tokens }),
      ...(response_format && { response_format }),
    });

    return res.status(200).json(response);
  } catch (error: any) {
    const status = error?.status || 500;
    const message = error?.message || 'Internal server error';
    return res.status(status).json({ error: message });
  }
}
