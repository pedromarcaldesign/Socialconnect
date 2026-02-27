import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import {
  ArrowLeft, Edit2, Save, X, RefreshCw, Upload, Trash2,
  Sparkles, Star, MapPin, Tag, Info, Camera, ZoomIn
} from 'lucide-react';
import toast from 'react-hot-toast';
import { hotelsApi, photosApi } from '../api';
import type { Hotel, Photo } from '../types';

function PhotoCard({ photo, hotelId, onDelete, onAnalyze }: {
  photo: Photo;
  hotelId: string;
  onDelete: (id: string) => void;
  onAnalyze: (id: string) => void;
}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await onAnalyze(photo.id);
      toast.success('Foto analisada com sucesso!');
    } catch {
      toast.error('Erro ao analisar foto');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="card group overflow-hidden">
      <div className="relative aspect-video bg-slate-100">
        <img
          src={photo.url}
          alt={photo.original_name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button
            onClick={() => setExpanded(true)}
            className="bg-white/90 p-2 rounded-full hover:bg-white transition-colors"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => onDelete(photo.id)}
            className="bg-red-500/90 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
        {photo.analysis?.setting && (
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
            {photo.analysis.setting}
          </div>
        )}
      </div>

      <div className="p-3">
        <p className="text-xs text-slate-500 truncate mb-2">{photo.original_name}</p>

        {photo.description ? (
          <p className="text-xs text-slate-700 line-clamp-2 mb-2">{photo.description}</p>
        ) : null}

        {photo.tags && photo.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {photo.tags.slice(0, 4).map(tag => (
              <span key={tag} className="badge-slate">{tag}</span>
            ))}
          </div>
        )}

        {photo.analysis?.mood && (
          <p className="text-xs text-slate-400 mb-2">
            <span className="font-medium">Atmosfera:</span> {photo.analysis.mood}
          </p>
        )}

        {!photo.description ? (
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="btn-secondary w-full text-xs py-1.5"
          >
            {analyzing ? (
              <>
                <RefreshCw size={12} className="animate-spin" />
                A analisar...
              </>
            ) : (
              <>
                <Sparkles size={12} />
                Analisar com IA
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="btn-ghost w-full text-xs py-1"
          >
            {analyzing ? 'A analisar...' : 'Re-analisar'}
          </button>
        )}
      </div>

      {/* Full image modal */}
      {expanded && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setExpanded(false)}
        >
          <button className="absolute top-4 right-4 text-white">
            <X size={24} />
          </button>
          <img
            src={photo.url}
            alt={photo.original_name}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}
    </div>
  );
}

export default function HotelDetail() {
  const { id } = useParams<{ id: string }>();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<Partial<Hotel>>({});

  useEffect(() => {
    if (!id) return;
    Promise.all([hotelsApi.get(id), photosApi.list(id)])
      .then(([h, p]) => {
        setHotel(h);
        setForm(h);
        setPhotos(p);
      })
      .catch(() => toast.error('Erro ao carregar hotel'))
      .finally(() => setLoading(false));
  }, [id]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!id || acceptedFiles.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await photosApi.upload(id, acceptedFiles);
      setPhotos(prev => [...uploaded, ...prev]);
      toast.success(`${uploaded.length} foto(s) carregada(s)!`);
    } catch {
      toast.error('Erro ao carregar fotos');
    } finally {
      setUploading(false);
    }
  }, [id]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    multiple: true,
  });

  const handleScrape = async () => {
    if (!id) return;
    setScraping(true);
    try {
      const updated = await hotelsApi.scrape(id);
      setHotel(updated);
      setForm(updated);
      toast.success('Informação atualizada com sucesso!');
    } catch {
      toast.error('Erro ao pesquisar informação');
    } finally {
      setScraping(false);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    try {
      const updated = await hotelsApi.update(id, {
        ...form,
        amenities: form.amenities || [],
        keywords: form.keywords || [],
      });
      setHotel(updated);
      setEditing(false);
      toast.success('Hotel atualizado!');
    } catch {
      toast.error('Erro ao guardar');
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!id || !confirm('Eliminar esta foto?')) return;
    try {
      await photosApi.delete(id, photoId);
      setPhotos(prev => prev.filter(p => p.id !== photoId));
      toast.success('Foto eliminada');
    } catch {
      toast.error('Erro ao eliminar foto');
    }
  };

  const handleAnalyzePhoto = async (photoId: string) => {
    if (!id) return;
    const updated = await photosApi.analyze(id, photoId);
    setPhotos(prev => prev.map(p => p.id === photoId ? { ...updated, url: p.url } : p));
  };

  if (loading) {
    return <div className="card p-8 shimmer h-64" />;
  }

  if (!hotel) {
    return (
      <div className="card p-8 text-center">
        <p className="text-slate-500">Hotel não encontrado</p>
        <Link to="/hotels" className="btn-secondary mt-4">← Voltar</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/hotels" className="btn-ghost p-2">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h2 className="font-bold text-slate-900 text-xl">{hotel.name}</h2>
          {hotel.location && (
            <p className="text-sm text-slate-400 flex items-center gap-1">
              <MapPin size={13} />
              {hotel.location}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="btn-secondary"
          >
            <RefreshCw size={15} className={scraping ? 'animate-spin' : ''} />
            {scraping ? 'A pesquisar...' : 'Pesquisar Info'}
          </button>
          {editing ? (
            <>
              <button onClick={handleSave} className="btn-primary">
                <Save size={15} /> Guardar
              </button>
              <button onClick={() => { setEditing(false); setForm(hotel); }} className="btn-secondary">
                <X size={15} /> Cancelar
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-secondary">
              <Edit2 size={15} /> Editar
            </button>
          )}
        </div>
      </div>

      {/* Hotel info */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Info size={16} className="text-brand-600" />
          <h3 className="font-semibold text-slate-800">Informação do Hotel</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {editing ? (
            <>
              <div>
                <label className="label">Nome</label>
                <input className="input" value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Website</label>
                <input className="input" value={form.website || ''} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
              </div>
              <div>
                <label className="label">Localização</label>
                <input className="input" value={form.location || ''} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
              </div>
              <div>
                <label className="label">Estrelas</label>
                <select className="input" value={form.stars || ''} onChange={e => setForm(f => ({ ...f, stars: parseInt(e.target.value) || undefined }))}>
                  <option value="">Sem classificação</option>
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} ⭐</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="label">Descrição</label>
                <textarea className="textarea" rows={3} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="label">Tom de escrita</label>
                <input className="input" value={form.tone || ''} onChange={e => setForm(f => ({ ...f, tone: e.target.value }))} placeholder="ex: luxuoso e sofisticado" />
              </div>
              <div>
                <label className="label">Público-alvo</label>
                <input className="input" value={form.target_audience || ''} onChange={e => setForm(f => ({ ...f, target_audience: e.target.value }))} />
              </div>
              <div>
                <label className="label">Instagram</label>
                <input className="input" value={form.instagram_handle || ''} onChange={e => setForm(f => ({ ...f, instagram_handle: e.target.value }))} placeholder="@hotel" />
              </div>
              <div>
                <label className="label">Facebook</label>
                <input className="input" value={form.facebook_page || ''} onChange={e => setForm(f => ({ ...f, facebook_page: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="label">Comodidades (separadas por vírgula)</label>
                <input
                  className="input"
                  value={(form.amenities || []).join(', ')}
                  onChange={e => setForm(f => ({ ...f, amenities: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                  placeholder="Piscina, Spa, Restaurante, Wi-Fi..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Palavras-chave (separadas por vírgula)</label>
                <input
                  className="input"
                  value={(form.keywords || []).join(', ')}
                  onChange={e => setForm(f => ({ ...f, keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                  placeholder="luxo, praia, família, negócios..."
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Localização</p>
                <p className="text-sm text-slate-700">{hotel.location || '—'}</p>
              </div>
              {hotel.stars && hotel.stars > 0 ? (
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Classificação</p>
                  <div className="flex gap-0.5">
                    {Array.from({ length: hotel.stars }).map((_, i) => (
                      <Star key={i} size={14} className="text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                </div>
              ) : null}
              {hotel.description && (
                <div className="md:col-span-2">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Descrição</p>
                  <p className="text-sm text-slate-700">{hotel.description}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Tom de Escrita</p>
                <p className="text-sm text-slate-700">{hotel.tone || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Público-alvo</p>
                <p className="text-sm text-slate-700">{hotel.target_audience || '—'}</p>
              </div>
              {hotel.amenities && hotel.amenities.length > 0 && (
                <div className="md:col-span-2">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">Comodidades</p>
                  <div className="flex flex-wrap gap-1.5">
                    {hotel.amenities.map(a => (
                      <span key={a} className="badge-blue">{a}</span>
                    ))}
                  </div>
                </div>
              )}
              {hotel.keywords && hotel.keywords.length > 0 && (
                <div className="md:col-span-2">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">
                    <Tag size={11} className="inline mr-1" />
                    Palavras-chave
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {hotel.keywords.map(k => (
                      <span key={k} className="badge-slate">#{k}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Photos section */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Camera size={16} className="text-brand-600" />
            <h3 className="font-semibold text-slate-800">Galeria de Fotos</h3>
            <span className="badge-slate">{photos.length}</span>
          </div>
        </div>

        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-5 ${
            isDragActive ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'
          }`}
        >
          <input {...getInputProps()} />
          <Upload size={24} className={`mx-auto mb-2 ${isDragActive ? 'text-brand-500' : 'text-slate-300'}`} />
          {uploading ? (
            <p className="text-sm text-brand-600 font-medium">A carregar fotos...</p>
          ) : isDragActive ? (
            <p className="text-sm text-brand-600 font-medium">Largar para carregar</p>
          ) : (
            <>
              <p className="text-sm text-slate-600 font-medium">Arraste fotos ou clique para selecionar</p>
              <p className="text-xs text-slate-400 mt-1">JPG, PNG, WEBP até 20MB cada</p>
            </>
          )}
        </div>

        {/* Photo grid */}
        {photos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map(photo => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                hotelId={hotel.id}
                onDelete={handleDeletePhoto}
                onAnalyze={handleAnalyzePhoto}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-4">
            Sem fotos ainda. Carregue as primeiras fotos do hotel.
          </p>
        )}
      </div>

      {/* Quick link to generate */}
      <div className="card p-5 bg-gradient-to-r from-brand-50 to-purple-50 border-brand-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800">Pronto para gerar publicações?</h3>
            <p className="text-sm text-slate-500 mt-1">
              {photos.length > 0
                ? 'Tem fotos carregadas. Crie publicações incríveis para as redes sociais.'
                : 'Carregue fotos primeiro para melhores resultados.'}
            </p>
          </div>
          <Link
            to={`/generate?hotel=${hotel.id}`}
            className="btn-primary whitespace-nowrap"
          >
            <Sparkles size={15} />
            Gerar Posts
          </Link>
        </div>
      </div>
    </div>
  );
}
