import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, Trash2, Edit2, Save, X, Filter, Sparkles,
  RefreshCw, Image, ExternalLink, Hash
} from 'lucide-react';
import toast from 'react-hot-toast';
import { postsApi, hotelsApi, photosApi } from '../api';
import type { Post, Hotel, Photo } from '../types';

function EditPostModal({
  post,
  hotels,
  onSave,
  onClose,
}: {
  post: Post;
  hotels: Hotel[];
  onSave: (updated: Post) => void;
  onClose: () => void;
}) {
  const [textPt, setTextPt] = useState(post.text_pt);
  const [hashtags, setHashtags] = useState(post.hashtags.join(' '));
  const [platform, setPlatform] = useState(post.platform);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState(post.photo_id || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (post.hotel_id) {
      photosApi.list(post.hotel_id).then(setPhotos).catch(console.error);
    }
  }, [post.hotel_id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await postsApi.update(post.id, {
        text_pt: textPt,
        hashtags: hashtags.split(/\s+/).filter(h => h.startsWith('#')),
        platform,
        photo_id: selectedPhoto || null,
      });
      onSave({ ...post, ...updated, hashtags: updated.hashtags || [] });
      toast.success('Post atualizado!');
    } catch {
      toast.error('Erro ao guardar');
    } finally {
      setSaving(false);
    }
  };

  const charCount = textPt.length;
  const instagramMax = 2200;
  const facebookRecommended = 500;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Editar Publicação</h3>
          <button onClick={onClose} className="btn-ghost p-1.5">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Texto (PT)</label>
              <span className={`text-xs ${charCount > instagramMax ? 'text-red-500' : charCount > facebookRecommended ? 'text-amber-500' : 'text-slate-400'}`}>
                {charCount} caracteres
              </span>
            </div>
            <textarea
              className="textarea"
              rows={10}
              value={textPt}
              onChange={e => setTextPt(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Hashtags</label>
            <input
              className="input"
              value={hashtags}
              onChange={e => setHashtags(e.target.value)}
              placeholder="#hotel #turismo #portugal"
            />
            <p className="text-xs text-slate-400 mt-1">Separados por espaço, começar com #</p>
          </div>

          <div>
            <label className="label">Plataforma</label>
            <select className="input" value={platform} onChange={e => setPlatform(e.target.value as Post['platform'])}>
              <option value="both">Ambas (Facebook + Instagram)</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
            </select>
          </div>

          {photos.length > 0 && (
            <div>
              <label className="label">Foto</label>
              <div className="grid grid-cols-4 gap-2">
                <div
                  onClick={() => setSelectedPhoto('')}
                  className={`aspect-square rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all ${
                    !selectedPhoto ? 'border-brand-500 bg-brand-50' : 'border-dashed border-slate-200'
                  }`}
                >
                  <X size={14} className="text-slate-400" />
                </div>
                {photos.map(p => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPhoto(p.id)}
                    className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                      selectedPhoto === p.id ? 'border-brand-500' : 'border-transparent'
                    }`}
                  >
                    <img src={p.url} alt="" className="w-full h-full object-cover" />
                    {selectedPhoto === p.id && (
                      <div className="absolute inset-0 bg-brand-500/30 flex items-center justify-center">
                        <Check size={16} className="text-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-200 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? <><RefreshCw size={15} className="animate-spin" /> A guardar...</> : <><Save size={15} /> Guardar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function PostCard({
  post,
  hotels,
  onApprove,
  onDelete,
  onUpdate,
}: {
  post: Post;
  hotels: Hotel[];
  onApprove: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (post: Post) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [approving, setApproving] = useState(false);

  const handleApprove = async () => {
    setApproving(true);
    try {
      await postsApi.approve(post.id);
      onApprove(post.id);
      toast.success('Publicação aprovada!');
    } catch {
      toast.error('Erro ao aprovar');
    } finally {
      setApproving(false);
    }
  };

  const imageUrl = post.photo_url || post.stock_image_url;
  const modeLabel = { batch: '🔄 Lote', manual: '✋ Manual', idea: '💡 Ideia' }[post.generation_mode];

  return (
    <>
      <div className="card overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          {/* Image */}
          {imageUrl && (
            <div className="sm:w-48 flex-shrink-0">
              <img src={imageUrl} alt="" className="w-full h-40 sm:h-full object-cover" />
            </div>
          )}

          <div className="flex-1 p-4 min-w-0">
            {/* Meta */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="badge-blue">{post.hotel_name}</span>
              <span className="badge-slate">{modeLabel}</span>
              <span className="badge-slate">
                {post.platform === 'both' ? '📱 Ambos' : post.platform === 'instagram' ? '📸 IG' : '📘 FB'}
              </span>
            </div>

            {/* Idea hint */}
            {post.idea && (
              <p className="text-xs text-slate-400 italic mb-2">💡 "{post.idea}"</p>
            )}

            {/* Text */}
            <p className="text-sm text-slate-700 line-clamp-4 whitespace-pre-line">{post.text_pt}</p>

            {/* Hashtags */}
            {post.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {post.hashtags.slice(0, 6).map(h => (
                  <span key={h} className="text-xs text-brand-500">{h}</span>
                ))}
                {post.hashtags.length > 6 && (
                  <span className="text-xs text-slate-400">+{post.hashtags.length - 6}</span>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button onClick={handleApprove} disabled={approving} className="btn-success py-1.5 px-3 text-xs">
                {approving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                Aprovar
              </button>
              <button onClick={() => setEditing(true)} className="btn-secondary py-1.5 px-3 text-xs">
                <Edit2 size={13} /> Editar
              </button>
              <button onClick={() => onDelete(post.id)} className="btn-ghost py-1.5 px-3 text-xs text-red-400 hover:text-red-600">
                <Trash2 size={13} /> Eliminar
              </button>
            </div>
          </div>
        </div>

        {/* Stock image credit */}
        {post.stock_image_url && post.stock_image_credit && (
          <div className="border-t border-slate-100 px-4 py-2 flex items-center gap-1.5">
            <Image size={12} className="text-slate-400" />
            <span className="text-xs text-slate-400">Imagem: {post.stock_image_credit}</span>
          </div>
        )}
      </div>

      {editing && (
        <EditPostModal
          post={post}
          hotels={hotels}
          onSave={updated => {
            onUpdate(updated);
            setEditing(false);
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}

export default function DraftPosts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterHotel, setFilterHotel] = useState('');

  useEffect(() => {
    Promise.all([
      postsApi.list({ status: 'draft' }),
      hotelsApi.list(),
    ]).then(([p, h]) => {
      setPosts(p);
      setHotels(h);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar esta publicação?')) return;
    try {
      await postsApi.delete(id);
      setPosts(prev => prev.filter(p => p.id !== id));
      toast.success('Publicação eliminada');
    } catch {
      toast.error('Erro ao eliminar');
    }
  };

  const filtered = filterHotel ? posts.filter(p => p.hotel_id === filterHotel) : posts;

  if (loading) {
    return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="card h-36 shimmer" />)}</div>;
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-slate-400" />
          <select
            className="input py-1.5 text-sm"
            value={filterHotel}
            onChange={e => setFilterHotel(e.target.value)}
          >
            <option value="">Todos os hotéis</option>
            {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        <span className="badge-amber ml-auto">{filtered.length} rascunhos</span>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Sparkles size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Sem publicações em rascunho</p>
          <Link to="/generate" className="btn-primary mt-4">
            <Sparkles size={15} />
            Gerar publicações
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(post => (
            <PostCard
              key={post.id}
              post={post}
              hotels={hotels}
              onApprove={id => setPosts(prev => prev.filter(p => p.id !== id))}
              onDelete={handleDelete}
              onUpdate={updated => setPosts(prev => prev.map(p => p.id === updated.id ? updated : p))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
