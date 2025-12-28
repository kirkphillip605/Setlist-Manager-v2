// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    const apiKey = Deno.env.get('HERE_API_KEY');

    if (!apiKey) {
      throw new Error("Missing HERE_API_KEY configuration");
    }

    if (!query) {
      throw new Error("Search query is required");
    }

    // Fixed parameters as requested
    const baseUrl = "https://discover.search.hereapi.com/v1/discover";
    const params = new URLSearchParams({
      limit: "10",
      in: "countryCode:USA",
      at: "39.8283,-98.5795", // Center of USA
      q: query,
      apiKey: apiKey
    });

    const response = await fetch(`${baseUrl}?${params.toString()}`);
    
    if (!response.ok) {
      const errText = await response.text();
      console.error("HERE API Error:", errText);
      throw new Error(`HERE API responded with ${response.status}`);
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error("Error in search-venue:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});