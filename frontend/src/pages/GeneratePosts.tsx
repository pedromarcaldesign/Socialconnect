import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Layers, Hand, Lightbulb, ChevronRight, Search,
  Image, Check, Loader2, Sparkles, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import { hotelsApi, photosApi, postsApi, imagesApi } from '../api';
import type { Hotel, Photo, StockImage } from '../types';

type Mode = 'batch' | 'manual' | 'idea';
type Platform = 'both' | 'facebook' | 'instagram';

// ---- Stock Image Search Modal ----
function StockImageModal({
  onSelect,
  onClose,
  initialQuery,
}: {
  onSelect: (img: StockImage) => void;
  onClose: () => void;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery || 'hotel luxury');
  const [results, setResults] = useState<StockImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<StockImage | null>(null);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const imgs = await imagesApi.search(query);
      setResults(imgs);
    } catch {
      toast.error('Erro ao pesquisar imagens');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { search(); }, []); // eslint-disable-line

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center gap-3">
          <h3 className="font-semibold text-slate-800 flex-1">Banco de Imagens Gratuito</h3>
          <button onClick={onClose} className="btn-ghost p-1.5">✕</button>
        </div>

        <div className="p-4 border-b border-slate-100 flex gap-2">
          <input
            className="input flex-1"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="pesquisar imagens..."
          />
          <button onClick={search} disabled={loading} className="btn-primary">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Pesquisar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {results.length === 0 && !loading && (
            <p className="text-center text-slate-400 py-8">Sem resultados. Tente outra pesquisa.</p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {results.map(img => (
              <div
                key={img.id}
                onClick={() => setSelected(img)}
                className={`relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all ${
                  selected?.id === img.id ? 'border-brand-500' : 'border-transparent hover:border-slate-300'
                }`}
              >
                <img src={img.thumb} alt={img.description} className="w-full aspect-video object-cover" />
                {selected?.id === img.id && (
                  <div className="absolute inset-0 bg-brand-500/20 flex items-center justify-center">
                    <div className="w-8 h-8 bg-brand-500 rounded-full flex items-center justify-center">
                      <Check size={16} className="text-white" />
                    </div>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 p-2">
                  <p className="text-white text-xs truncate">{img.author}</p>
                  <span className="text-white/70 text-xs capitalize">{img.source}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            onClick={() => selected && onSelect(selected)}
            disabled={!selected}
            className="btn-primary"
          >
            Usar esta imagem
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Platform selector ----
function PlatformSelector({ value, onChange }: { value: Platform; onChange: (v: Platform) => void }) {
  return (
    <div className="flex gap-2">
      {(['both', 'instagram', 'facebook'] as Platform[]).map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            value === p
              ? 'bg-brand-600 text-white border-brand-600'
              : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'
          }`}
        >
          {p === 'both' ? '📱 Ambos' : p === 'instagram' ? '📸 Instagram' : '📘 Facebook'}
        </button>
      ))}
    </div>
  );
}

export default function GeneratePosts() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const preselectedHotel = searchParams.get('hotel');

  const [mode, setMode] = useState<Mode>('manual');
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [platform, setPlatform] = useState<Platform>('both');
  const [generating, setGenerating] = useState(false);

  // Batch mode
  const [selectedHotels, setSelectedHotels] = useState<string[]>([]);

  // Manual mode
  const [selectedHotel, setSelectedHotel] = useState<string>(preselectedHotel || '');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string>('');
  const [stockImage, setStockImage] = useState<StockImage | null>(null);
  const [showStockModal, setShowStockModal] = useState(false);

  // Idea mode
  const [idea, setIdea] = useState('');

  useEffect(() => {
    hotelsApi.list().then(setHotels).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedHotel) {
      photosApi.list(selectedHotel).then(setPhotos).catch(console.error);
      setSelectedPhoto('');
    }
  }, [selectedHotel]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      let result;

      if (mode === 'batch') {
        if (selectedHotels.length === 0) {
          toast.error('Selecione pelo menos um hotel');
          return;
        }
        result = await postsApi.generateBatch({ hotel_ids: selectedHotels, platform });
        toast.success(`${result.length} publicação(ões) gerada(s)!`);
      } else if (mode === 'manual') {
        if (!selectedHotel) {
          toast.error('Selecione um hotel');
          return;
        }
        result = await postsApi.generateManual({
          hotel_id: selectedHotel,
          photo_id: selectedPhoto || undefined,
          platform,
          stock_image_url: stockImage?.url,
          stock_image_credit: stockImage ? `${stockImage.author} via ${stockImage.source}` : undefined,
        });
        toast.success('Publicação gerada!');
      } else {
        if (!selectedHotel || !idea.trim()) {
          toast.error('Selecione um hotel e escreva uma ideia');
          return;
        }
        result = await postsApi.generateIdea({
          hotel_id: selectedHotel,
          idea: idea.trim(),
          platform,
        });
        toast.success('Publicação gerada a partir da sua ideia!');
      }

      navigate('/drafts');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar publicação');
    } finally {
      setGenerating(false);
    }
  };

  const modes = [
    {
      id: 'batch' as Mode,
      label: 'Em Lote',
      icon: Layers,
      description: 'Seleciona hotéis, a app escolhe foto e cria texto automaticamente',
    },
    {
      id: 'manual' as Mode,
      label: 'Manual',
      icon: Hand,
      description: 'Escolhes o hotel e a foto, a app cria o texto',
    },
    {
      id: 'idea' as Mode,
      label: 'Por Ideia',
      icon: Lightbulb,
      description: 'Escreves uma ideia, a app sugere foto e/ou cria o texto',
    },
  ];

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Mode selector */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-800 mb-4">Modo de Geração</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {modes.map(({ id, label, icon: Icon, description }) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                mode === id
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-slate-200 hover:border-brand-200 hover:bg-slate-50'
              }`}
            >
              <Icon size={20} className={mode === id ? 'text-brand-600' : 'text-slate-400'} />
              <p className={`font-medium text-sm mt-2 ${mode === id ? 'text-brand-700' : 'text-slate-700'}`}>
                {label}
              </p>
              <p className="text-xs text-slate-400 mt-1">{description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Platform */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-800 mb-3">Plataforma</h3>
        <PlatformSelector value={platform} onChange={setPlatform} />
      </div>

      {/* Mode-specific config */}
      <div className="card p-5">
        {/* BATCH MODE */}
        {mode === 'batch' && (
          <div>
            <h3 className="font-semibold text-slate-800 mb-4">Selecionar Hotéis</h3>
            {hotels.length === 0 ? (
              <p className="text-slate-400 text-sm">Sem hotéis disponíveis.</p>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedHotels(
                    selectedHotels.length === hotels.length ? [] : hotels.map(h => h.id)
                  )}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                >
                  {selectedHotels.length === hotels.length ? 'Desselecionar todos' : 'Selecionar todos'}
                </button>
                {hotels.map(hotel => (
                  <label key={hotel.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedHotels.includes(hotel.id) ? 'border-brand-300 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}>
                    <input
                      type="checkbox"
                      checked={selectedHotels.includes(hotel.id)}
                      onChange={e => setSelectedHotels(prev =>
                        e.target.checked ? [...prev, hotel.id] : prev.filter(id => id !== hotel.id)
                      )}
                      className="accent-brand-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{hotel.name}</p>
                      <p className="text-xs text-slate-400">{hotel.location || 'Sem localização'} · {hotel.photo_count || 0} fotos</p>
                    </div>
                    {selectedHotels.includes(hotel.id) && (
                      <Check size={16} className="text-brand-600 flex-shrink-0" />
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MANUAL MODE */}
        {mode === 'manual' && (
          <div className="space-y-4">
            <div>
              <label className="label">Hotel</label>
              <select
                className="input"
                value={selectedHotel}
                onChange={e => setSelectedHotel(e.target.value)}
              >
                <option value="">-- Selecionar hotel --</option>
                {hotels.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>

            {selectedHotel && (
              <>
                <div>
                  <label className="label">Foto do Hotel</label>
                  {photos.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      <div
                        onClick={() => { setSelectedPhoto(''); setStockImage(null); }}
                        className={`aspect-square rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all ${
                          !selectedPhoto && !stockImage ? 'border-brand-500 bg-brand-50' : 'border-dashed border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <p className="text-xs text-slate-400 text-center px-1">Sem foto</p>
                      </div>
                      {photos.map(photo => (
                        <div
                          key={photo.id}
                          onClick={() => { setSelectedPhoto(photo.id); setStockImage(null); }}
                          className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                            selectedPhoto === photo.id ? 'border-brand-500' : 'border-transparent hover:border-slate-300'
                          }`}
                        >
                          <img src={photo.url} alt="" className="w-full h-full object-cover" />
                          {selectedPhoto === photo.id && (
                            <div className="absolute inset-0 bg-brand-500/20 flex items-center justify-center">
                              <div className="w-6 h-6 bg-brand-500 rounded-full flex items-center justify-center">
                                <Check size={12} className="text-white" />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Este hotel não tem fotos. Adicione fotos no perfil do hotel.</p>
                  )}
                </div>

                {/* Stock image option */}
                <div>
                  <label className="label">Ou usar banco de imagens gratuito</label>
                  {stockImage ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-brand-300 bg-brand-50">
                      <img src={stockImage.thumb} alt="" className="w-16 h-12 object-cover rounded" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{stockImage.description}</p>
                        <a
                          href={stockImage.author_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-slate-400 hover:text-brand-600 flex items-center gap-1"
                        >
                          {stockImage.author} · {stockImage.source}
                          <ExternalLink size={10} />
                        </a>
                      </div>
                      <button onClick={() => setStockImage(null)} className="btn-ghost p-1.5 text-slate-400">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowStockModal(true)}
                      className="btn-secondary w-full"
                    >
                      <Image size={15} />
                      Pesquisar imagens gratuitas
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* IDEA MODE */}
        {mode === 'idea' && (
          <div className="space-y-4">
            <div>
              <label className="label">Hotel</label>
              <select className="input" value={selectedHotel} onChange={e => setSelectedHotel(e.target.value)}>
                <option value="">-- Selecionar hotel --</option>
                {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">A tua ideia para o post</label>
              <textarea
                className="textarea"
                rows={4}
                value={idea}
                onChange={e => setIdea(e.target.value)}
                placeholder="ex: Destacar o pequeno-almoço com vista para o mar, promover um fim de semana em casal, anunciar uma promoção de verão..."
              />
              <p className="text-xs text-slate-400 mt-1">
                A IA vai usar esta ideia para criar o texto e sugerir a foto mais adequada da galeria do hotel.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="btn-primary w-full py-3 text-base justify-center"
      >
        {generating ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            A gerar com IA...
          </>
        ) : (
          <>
            <Sparkles size={18} />
            Gerar Publicação
            <ChevronRight size={16} />
          </>
        )}
      </button>

      {/* Stock image modal */}
      {showStockModal && (
        <StockImageModal
          onClose={() => setShowStockModal(false)}
          onSelect={img => {
            setStockImage(img);
            setSelectedPhoto('');
            setShowStockModal(false);
          }}
          initialQuery={
            hotels.find(h => h.id === selectedHotel)?.name
              ? `hotel ${hotels.find(h => h.id === selectedHotel)?.location || ''}`
              : 'luxury hotel'
          }
        />
      )}
    </div>
  );
}
