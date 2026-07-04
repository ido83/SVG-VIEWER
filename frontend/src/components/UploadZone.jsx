import { useRef, useState } from "react";

export default function UploadZone({ onUpload, busy }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [tagText, setTagText] = useState("");

  const parseTags = () =>
    tagText
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

  const handleFiles = (fileList) => {
    const files = [...fileList].filter(
      (f) => f.type === "image/svg+xml" || f.name.toLowerCase().endsWith(".svg")
    );
    if (files.length) onUpload(files, parseTags());
  };

  return (
    <section
      className={`upload-zone ${dragging ? "is-dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <div className="upload-copy">
        <h2>Add vectors to the bench</h2>
        <p>Drop .svg files here, or browse from your computer.</p>
      </div>

      <div className="upload-controls">
        <input
          type="text"
          className="tag-input"
          placeholder="Tags for this batch, comma-separated (icons, logo, ui)"
          value={tagText}
          onChange={(e) => setTagText(e.target.value)}
          aria-label="Tags for uploaded files"
        />
        <button
          className="btn btn-primary"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? "Uploading…" : "Browse files"}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".svg,image/svg+xml"
        multiple
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </section>
  );
}
