import { useState } from "react";
import { api, formatSize } from "../api.js";

export default function SvgCard({ item, onDelete, onUpdate, onTagClick }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [tags, setTags] = useState(item.tags.join(", "));

  const save = async () => {
    const updated = await api.update(item.id, { name, tags });
    onUpdate(updated);
    setEditing(false);
  };

  return (
    <article className="card">
      <div className="card-preview">
        <img src={api.rawUrl(item.id)} alt={item.name} loading="lazy" />
      </div>

      {editing ? (
        <div className="card-edit">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="File name"
          />
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="tags, comma, separated"
            aria-label="Tags"
          />
          <div className="card-edit-actions">
            <button className="btn btn-primary btn-sm" onClick={save}>
              Save changes
            </button>
            <button className="btn btn-sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="card-body">
          <h3 className="card-name" title={item.name}>
            {item.name}
          </h3>
          <p className="card-meta">
            {formatSize(item.size)} ·{" "}
            {new Date(item.uploadedAt).toLocaleDateString()}
          </p>
          <div className="card-tags">
            {item.tags.length ? (
              item.tags.map((t) => (
                <button key={t} className="tag" onClick={() => onTagClick(t)}>
                  {t}
                </button>
              ))
            ) : (
              <span className="tag tag-empty">untagged</span>
            )}
          </div>
        </div>
      )}

      <div className="card-actions">
        <a className="btn btn-primary btn-sm" href={api.downloadUrl(item.id)}>
          Download
        </a>
        <button className="btn btn-sm" onClick={() => setEditing((v) => !v)}>
          Edit
        </button>
        <button
          className="btn btn-danger btn-sm"
          onClick={() => onDelete(item.id)}
        >
          Delete
        </button>
      </div>
    </article>
  );
}
