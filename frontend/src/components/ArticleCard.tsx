import { Link } from "react-router-dom";
import { Star, Archive, Trash2, ArchiveRestore } from "lucide-react";
import { Article, api } from "../lib/api";
import { relTime } from "../lib/utils";

export default function ArticleCard({
  article,
  onChange,
}: {
  article: Article;
  onChange: () => void;
}) {
  async function toggleFav(e: React.MouseEvent) {
    e.preventDefault();
    await api.update(article.id, { is_favorite: !article.is_favorite });
    onChange();
  }
  async function toggleArchive(e: React.MouseEvent) {
    e.preventDefault();
    await api.update(article.id, { is_archived: !article.is_archived });
    onChange();
  }
  async function del(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm("Delete this article?")) return;
    await api.remove(article.id);
    onChange();
  }

  return (
    <Link
      to={`/read/${article.id}`}
      className="group block rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden hover:border-neutral-400 dark:hover:border-neutral-600 transition"
    >
      {article.image_url && (
        <div className="aspect-video bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
          <img
            src={article.image_url}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        </div>
      )}
      <div className="p-4">
        <div className="text-xs text-neutral-500 flex items-center gap-2 mb-1">
          <span>{article.site_name || "—"}</span>
          <span>·</span>
          <span>{article.read_time_min} min</span>
          <span>·</span>
          <span>{relTime(article.created_at)}</span>
        </div>
        <h3 className="font-semibold text-lg leading-snug line-clamp-2">
          {article.title}
        </h3>
        {article.summary_short && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2 line-clamp-2">
            {article.summary_short}
          </p>
        )}
        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {article.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-1 mt-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">
          <button onClick={toggleFav} className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <Star className={`w-4 h-4 ${article.is_favorite ? "fill-yellow-500 text-yellow-500" : ""}`} />
          </button>
          <button onClick={toggleArchive} className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
            {article.is_archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
          </button>
          <button onClick={del} className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900 ml-auto">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>
    </Link>
  );
}
