import { useEffect, useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  CheckCircle, Check, Globe, Copy, Undo2, Trash2, Filter,
  Loader2, Languages, Image, ChevronDown, ChevronUp, RefreshCw,
  Edit2, Save, X, Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import { postsApi, hotelsApi, photosApi } from '../api';
import type { Post, Hotel, Photo } from '../types';

const PT_FLAG = '🇵🇹';
const EN_FLAG = '🇬🇧';

function EditPostModal({
  post,
  onSave,
  onClose,
}: {
  post: Post;
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
              <span className={`text-xs ${charCount > 2200 ? 'text-red-500' : charCount > 500 ? 'text-amber-500' : 'text-slate-400'}`}>
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

function ApprovedPostCard({
  post,
  onUnapprove,
  onDelete,
  onUpdate,
}: {
  post: Post;
  onUnapprove: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (post: Post) => void;
}) {
  const [translating, setTranslating] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editing, setEditing] = useState(false);

  const handleTranslate = async () => {
    setTranslating(true);
    try {
      const result = await postsApi.translate(post.id);
      onUpdate({ ...post, text_en: result.text_en, is_bilingual: true });
      toast.success('Traduzido para inglês!');
    } catch {
      toast.error('Erro ao traduzir');
    } finally {
      setTranslating(false);
    }
  };

  const handleToggleBilingual = async () => {
    setToggling(true);
    try {
      const result = await postsApi.toggleBilingual(post.id);
      onUpdate({ ...post, is_bilingual: result.is_bilingual });
    } catch {
      toast.error('Erro');
    } finally {
      setToggling(false);
    }
  };

  const handleCopy = () => {
    let text = '';
    if (post.is_bilingual && post.text_en) {
      text = `${PT_FLAG}\n${post.text_pt}\n\n${post.hashtags.join(' ')}\n\n${EN_FLAG}\n${post.text_en}`;
    } else {
      text = `${post.text_pt}\n\n${post.hashtags.join(' ')}`;
    }
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência!');
  };

  const handleDownload = async () => {
    const url = post.photo_url || post.stock_image_url;
    if (!url) {
      toast.error('Esta publicação não tem imagem');
      return;
    }
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${(post.hotel_name || 'post').replace(/\s+/g, '-').toLowerCase()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast.success('Download iniciado!');
    } catch {
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  };

  const imageUrl = post.photo_url || post.stock_image_url;
  const modeLabel = { batch: '🔄 Lote', manual: '✋ Manual', idea: '💡 Ideia' }[post.generation_mode];
  const platformLabel = post.platform === 'both' ? '📱 FB + IG' : post.platform === 'instagram' ? '📸 IG' : '📘 FB';

  return (
    <>
      <div className="card overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          {/* Image */}
          {imageUrl && (
            <div className="sm:w-48 flex-shrink-0 relative">
              <img src={imageUrl} alt="" className="w-full h-40 sm:h-full object-cover" />
              <button
                onClick={handleDownload}
                className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-lg p-1.5 transition-colors"
                title="Download da imagem"
              >
                <Download size={14} />
              </button>
            </div>
          )}

          <div className="flex-1 p-4 min-w-0">
            {/* Meta */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="badge-blue">{post.hotel_name}</span>
              <span className="badge-slate">{modeLabel}</span>
              <span className="badge-slate">{platformLabel}</span>
              {post.is_bilingual && <span className="badge-green">{PT_FLAG} + {EN_FLAG} Bilingue</span>}
            </div>

            {/* Post preview */}
            <div className="bg-slate-50 rounded-xl p-3 space-y-3">
              {/* Portuguese */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-base">{PT_FLAG}</span>
                  <span className="text-xs font-medium text-slate-500">Português</span>
                </div>
                <p className={`text-sm text-slate-700 whitespace-pre-line ${expanded ? '' : 'line-clamp-3'}`}>
                  {post.text_pt}
                </p>
              </div>

              {/* English (if bilingual and has translation) */}
              {post.is_bilingual && post.text_en && (
                <div className="border-t border-slate-200 pt-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-base">{EN_FLAG}</span>
                    <span className="text-xs font-medium text-slate-500">English</span>
                  </div>
                  <p className={`text-sm text-slate-700 whitespace-pre-line ${expanded ? '' : 'line-clamp-3'}`}>
                    {post.text_en}
                  </p>
                </div>
              )}

              {/* Hashtags */}
              {post.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {post.hashtags.map(h => (
                    <span key={h} className="text-xs text-brand-500">{h}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Expand/collapse */}
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mt-2"
            >
              {expanded ? <><ChevronUp size={13} /> Ver menos</> : <><ChevronDown size={13} /> Ver mais</>}
            </button>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {/* Copy */}
              <button onClick={handleCopy} className="btn-secondary py-1.5 px-3 text-xs">
                <Copy size={13} /> Copiar
              </button>

              {/* Download (shown also as text button when no image in the card above) */}
              {!imageUrl && (
                <button onClick={handleDownload} className="btn-secondary py-1.5 px-3 text-xs">
                  <Download size={13} /> Download
                </button>
              )}

              {/* Edit */}
              <button onClick={() => setEditing(true)} className="btn-secondary py-1.5 px-3 text-xs">
                <Edit2 size={13} /> Editar
              </button>

              {/* Bilingual actions */}
              {!post.text_en ? (
                <button
                  onClick={handleTranslate}
                  disabled={translating}
                  className="btn-secondary py-1.5 px-3 text-xs"
                >
                  {translating ? <Loader2 size={13} className="animate-spin" /> : <Languages size={13} />}
                  Tornar Bilingue
                </button>
              ) : (
                <button
                  onClick={handleToggleBilingual}
                  disabled={toggling}
                  className={`py-1.5 px-3 text-xs ${post.is_bilingual ? 'btn-secondary' : 'btn-ghost'}`}
                >
                  <Globe size={13} />
                  {post.is_bilingual ? 'Desativar EN' : 'Mostrar EN'}
                </button>
              )}

              {/* Move to draft */}
              <button
                onClick={() => {
                  postsApi.unapprove(post.id).then(() => {
                    onUnapprove(post.id);
                    toast.success('Movido para rascunhos');
                  }).catch(() => toast.error('Erro'));
                }}
                className="btn-ghost py-1.5 px-3 text-xs text-slate-400"
              >
                <Undo2 size={13} /> Rascunho
              </button>

              {/* Delete */}
              {confirmingDelete ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">Tens a certeza?</span>
                  <button
                    onClick={() => {
                      postsApi.delete(post.id).then(() => {
                        onDelete(post.id);
                        toast.success('Eliminado');
                      }).catch(() => toast.error('Erro ao eliminar'));
                      setConfirmingDelete(false);
                    }}
                    className="py-1 px-2 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-1"
                  >
                    <Check size={12} /> Sim
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="py-1 px-2 text-xs rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    Não
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className="btn-ghost py-1.5 px-3 text-xs text-red-400 hover:text-red-600"
                >
                  <Trash2 size={13} /> Eliminar
                </button>
              )}
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

export default function ApprovedPosts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterHotel, setFilterHotel] = useState('');
  const [filterBilingual, setFilterBilingual] = useState(false);
  const location = useLocation();

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      postsApi.list({ status: 'approved' }),
      hotelsApi.list(),
    ]).then(([p, h]) => {
      setPosts(p);
      setHotels(h);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, location.key]);

  let filtered = filterHotel ? posts.filter(p => p.hotel_id === filterHotel) : posts;
  if (filterBilingual) filtered = filtered.filter(p => p.is_bilingual);

  const handleCopyAll = () => {
    const text = filtered.map(p => {
      let t = `--- ${p.hotel_name} ---\n`;
      if (p.is_bilingual && p.text_en) {
        t += `🇵🇹\n${p.text_pt}\n\n${p.hashtags.join(' ')}\n\n🇬🇧\n${p.text_en}`;
      } else {
        t += `${p.text_pt}\n\n${p.hashtags.join(' ')}`;
      }
      return t;
    }).join('\n\n\n');

    navigator.clipboard.writeText(text);
    toast.success(`${filtered.length} post(s) copiado(s)!`);
  };

  if (loading) {
    return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="card h-36 shimmer" />)}</div>;
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Filters + actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={15} className="text-slate-400" />
          <select
            className="input py-1.5 text-sm"
            value={filterHotel}
            onChange={e => setFilterHotel(e.target.value)}
          >
            <option value="">Todos os hotéis</option>
            {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={filterBilingual}
              onChange={e => setFilterBilingual(e.target.checked)}
              className="accent-brand-600"
            />
            Só bilingues
          </label>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="badge-green">{filtered.length} aprovadas</span>
          {filtered.length > 0 && (
            <button onClick={handleCopyAll} className="btn-secondary py-1.5 px-3 text-xs">
              Copiar todas
            </button>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="btn-ghost p-1.5 rounded-lg"
            title="Atualizar lista"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-slate-400' : 'text-slate-400'} />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Nenhuma publicação aprovada ainda</p>
          <p className="text-xs text-slate-400 mt-2">Aprove publicações na secção de rascunhos</p>
          <Link to="/drafts" className="btn-secondary mt-4">Ver rascunhos</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(post => (
            <ApprovedPostCard
              key={post.id}
              post={post}
              onUnapprove={id => setPosts(prev => prev.filter(p => p.id !== id))}
              onDelete={id => setPosts(prev => prev.filter(p => p.id !== id))}
              onUpdate={updated => setPosts(prev => prev.map(p => p.id === updated.id ? updated : p))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
