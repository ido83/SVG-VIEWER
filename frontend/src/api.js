const json = async (res) => {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
};

export const api = {
  list: () => fetch("/api/svgs").then(json),
  tags: () => fetch("/api/tags").then(json),
  upload: (files, tags) => {
    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    fd.append("tags", tags.join(","));
    return fetch("/api/svgs", { method: "POST", body: fd }).then(json);
  },
  update: (id, patch) =>
    fetch(`/api/svgs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then(json),
  remove: (id) => fetch(`/api/svgs/${id}`, { method: "DELETE" }).then(json),
  rawUrl: (id) => `/api/svgs/${id}/raw`,
  downloadUrl: (id) => `/api/svgs/${id}/download`,
};

export const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};
