// Este arquivo é gerado automaticamente. Não edite diretamente.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://yveobskzyejuaixqsgid.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2ZW9ic2t6eWVqdWFpeHFzZ2lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4NTEwNDUsImV4cCI6MjA3MzQyNzA0NX0.nsK3IYWDF_SEKHArP34wLgxtGBTBnBnOAyqsb-EX9ic";

// Importe o cliente supabase assim:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);