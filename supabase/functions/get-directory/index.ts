import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DirectoryRequest {
  query: string;
  accessToken: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, accessToken }: DirectoryRequest = await req.json();
    
    // Get user from authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Check if user has edu email
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('is_edu_account')
      .eq('user_id', user.id)
      .single();

    if (!profile?.is_edu_account) {
      return new Response(
        JSON.stringify({ error: "Directory access requires an educational account" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Search directory contacts for this user
    const { data: contacts, error } = await supabaseClient
      .from('directory_contacts')
      .select('*')
      .eq('user_id', user.id)
      .ilike('contact_name', `%${query}%`);

    if (error) {
      throw new Error(error.message);
    }

    return new Response(JSON.stringify({ contacts: contacts || [] }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in get-directory function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);