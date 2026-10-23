"use client";
import { createClient } from "@supabase/supabase-js";
const storage = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  }).storage.from("submissions");

export async function uploadSignedFile(path: string, token: string, file: File) { return storage().uploadToSignedUrl(path, token, file); }
