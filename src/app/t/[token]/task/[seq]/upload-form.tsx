"use client";

import { useRef, useState, useTransition } from "react";
import { uploadSignedFile } from "@/client/storage-upload";
import { prepareUpload, submitWork } from "../../actions";

export function UploadForm({ token, seq, criteria, flagged = [], isOwner, ownerName, meName }: {
  token: string; seq: number; criteria: string[]; flagged?: number[]; isOwner: boolean; ownerName: string; meName: string;
}) {
  const [mode, setMode] = useState<"file" | "link">("file");
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [checked, setChecked] = useState<boolean[]>(() => criteria.map(() => false));
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const left = criteria.flatMap((text, i) => (checked[i] ? [] : [{ i, text }]));
  const toggle = (i: number) => setChecked(checked.map((c, j) => (j === i ? !c : c)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // 올리기 전에 스스로 기준을 하나씩 확인한다. 남은 항목이 있으면 팝업으로 알려 주고 올리지 않는다
    if (left.length) { dialog.current?.showModal(); return; }
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
        checked: checked.flatMap((c, i) => (c ? [i] : [])),
      });
      if (res.error) return setError(res.error);
      setDone(true); setFile(null); setLink(""); setNote(""); setChecked(criteria.map(() => false));
      if (fileInput.current) fileInput.current.value = "";
    });
  };

  if (done) {
    return (
      <section className="upload-form">
        <h3>올렸습니다</h3>
        <p className="muted">다른 팀원이 기준 항목마다 확인합니다. 전원이 충족으로 확인하거나 12시간 동안 미충족 의견이 없으면 “완료”로 바뀝니다.</p>
        <button className="btn ghost" type="button" onClick={() => setDone(false)}>다른 파일 더 올리기</button>
      </section>
    );
  }

  return (
    <form className="upload-form" onSubmit={submit}>
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
          <input id="file" ref={fileInput} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      ) : (
        <label className="field">
          <span>링크 (구글 드라이브·노션·구글폼 등)</span>
          <input id="link" type="url" inputMode="url" placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} />
        </label>
      )}

      <fieldset className="self-check">
        <legend>
          올리기 전 확인 <span className="num muted">{criteria.length - left.length}/{criteria.length}</span>
        </legend>
        <p className="muted small">완료 기준을 하나씩 확인하고 체크해 주세요. 모두 체크해야 올릴 수 있습니다.</p>
        <ul>
          {criteria.map((text, i) => (
            <li key={i}>
              <label className={[checked[i] ? "on" : "", flagged.includes(i) ? "flagged" : ""].join(" ").trim() || undefined}>
                <input type="checkbox" checked={checked[i]} onChange={() => toggle(i)} />
                <span className="box" aria-hidden="true" />
                <span className="self-check-text"><span className="num criteria-no">{i + 1}</span>{text}</span>
                {flagged.includes(i) && <span className="flag-note">피드백 받음</span>}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <label className="field">
        <span>한 줄 메모 (선택)</span>
        <input id="note" type="text" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 3장은 내일 보완 예정" />
      </label>

      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn lime" type="submit" disabled={pending}>{pending ? "올리는 중…" : flagged.length ? "다시 올리기" : "올리기"}</button>

      <dialog ref={dialog} className="modal" aria-labelledby={`left-${seq}`} onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}>
        <div className="modal-body">
          <h2 id={`left-${seq}`}>아직 확인하지 않은 기준이 있어요</h2>
          <p className="muted small">결과물이 아래 항목을 채웠는지 직접 확인하고 체크해야 올릴 수 있습니다.</p>
          <ul className="modal-list">
            {left.map(({ i, text }) => <li key={i}><span className="num criteria-no">{i + 1}</span>{text}</li>)}
          </ul>
          <p className="muted small">체크는 올리는 사람이 스스로 확인하는 단계예요. 올린 뒤에는 다른 팀원이 항목마다 다시 확인합니다.</p>
          <button className="btn" type="button" onClick={() => dialog.current?.close()}>확인하러 가기</button>
        </div>
      </dialog>
    </form>
  );
}
