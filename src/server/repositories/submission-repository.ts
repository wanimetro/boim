import "server-only";
import { db, BUCKET } from "@/lib/supabase";
export const submissionRepository = {
  async task(teamId: string, seq: number) {
    const { data, error } = await db().from("tasks").select("id, seq, criteria").eq("team_id", teamId).eq("seq", seq).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("업무를 찾을 수 없습니다.");
    return data;
  },
  async prepare(path: string) {
    const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error("업로드를 준비하지 못했습니다.");
    return { path: data.path, signedToken: data.token };
  },
  async signedUrl(path: string) {
    const { data } = await db().storage.from(BUCKET).createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  },
  async save(input: { task_id: string; uploader_id: string; file_path: string | null; file_name: string | null; link_url: string | null; note: string | null }) {
    const { error } = await db().from("submissions").insert(input); if (error) throw error;
  },
};
