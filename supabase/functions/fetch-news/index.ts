import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

async function scrapeFullText(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    if (!res.ok) return "";
    const html = await res.text();
    const $ = cheerio.load(html);

    // Extract text from all paragraph tags, filter out empty ones, and join with double newlines
    const paragraphs: string[] = [];
    $('p').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 20) paragraphs.push(text); // Ignore tiny UI text
    });

    return paragraphs.join('\n\n');
  } catch (e) {
    return "";
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      // Graceful fallback if invoked without a body (e.g., a raw GET ping)
    }

    // We allow the frontend to request specific languages or categories
    const { language = 'en', category = 'general' } = body;

    // Grab the hidden secret key
    const apiKey = Deno.env.get('GNEWS_API_KEY');
    console.log("🔑 API Key Status: ", apiKey ? "Found" : "Missing");
    if (!apiKey) throw new Error("Missing GNEWS_API_KEY. Please set it in the .env.local file or Supabase Secrets.");

    // Call the GNews API (max=10 for standard free tier limit)
    const url = `https://gnews.io/api/v4/top-headlines?category=${category}&lang=${language}&max=10&apikey=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    // GNews API typically includes errors array if it fails
    if (!response.ok || data.errors) {
      const gnewsError = data.errors ? data.errors[0] : (data.message || "News API Error");
      throw new Error(gnewsError);
    }

    // Process articles concurrently to get full text
    const processedArticles = await Promise.all(
        data.articles.map(async (article: any) => {
            const fullText = await scrapeFullText(article.url);
            return {
                ...article,
                content: fullText || article.description || article.content
            };
        })
    );

    // Return the clean JSON back to your React app
    return new Response(JSON.stringify({ success: true, articles: processedArticles }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});