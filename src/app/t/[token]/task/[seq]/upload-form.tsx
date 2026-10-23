"use client";

import { useState, useTransition } from "react";
import { uploadSignedFile } from "@/client/storage-upload";
import { prepareUpload, submitWork } from "../../actions";

export function UploadForm({ token, seq, isOwner, ownerName, meName }: {
  token: string; seq: number; isOwner: boolean; ownerName: string; meName: string;
}) {
  const [mode, setMode] = useState<"file" | "link">("file");
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      let path: string | undefined;
      if (mode === "file") {
        if (!file) return setError("올릴 파일을 골라 주세요.");
        const prep = await prepareUpload(token, seq, file.name, file.size);
        if ("error" in prep) return setError(prep.error ?? "업로드를 준비하지 못했습니다.");
        const { error: upErr } = await uploadSignedFile(prep.path, prep.signedToken, file);
        if (upErr) return setError("파일을 올리지 못했습니다. 연결을 확인하고 다시 시도해 주세요.");
        path = prep.path;
      }
      const res = await submitWork(token, seq, {
        path, fileName: file?.name, link: mode === "link" ? link : undefined, note,
      });
      if (res.error) return setError(res.error);
      setDone(true); setFile(null); setLink(""); setNote("");
    });
  };

  if (done) {
    return (
      <section className="panel">
        <h2>올렸습니다</h2>
        <p className="muted">완료 기준에 맞는지 확인한 뒤 “완료”로 바뀝니다. 지금은 “확인 중”으로 보입니다.</p>
        <button className="btn ghost" type="button" onClick={() => setDone(false)}>다른 파일 더 올리기</button>
      </section>
    );
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2>결과물 올리기</h2>
      {!isOwner && (
        <p className="callout warn-box small">
          이 업무의 담당은 <b>{ownerName}</b> 님입니다. <b>{meName}</b> 님이 대신 올리는 것으로 기록됩니다.
        </p>
      )}
      <div className="seg" role="tablist" aria-label="올리는 방식">
        <button type="button" role="tab" aria-selected={mode === "file"} onClick={() => setMode("file")}>파일</button>
        <button type="button" role="tab" aria-selected={mode === "link"} onClick={() => setMode("link")}>링크</button>
      </div>

      {mode === "file" ? (
        <label className="field">
          <span>파일 (20MB까지)</span>
          <input id="file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      ) : (
        <label className="field">
          <span>링크 (구글 드라이브·노션·구글폼 등)</span>
          <input id="link" type="url" inputMode="url" placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} />
        </label>
      )}

      <label className="field">
        <span>한 줄 메모 (선택)</span>
        <input id="note" type="text" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 3장은 내일 보완 예정" />
      </label>

      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "올리는 중…" : "올리기"}</button>
    </form>
  );
}
