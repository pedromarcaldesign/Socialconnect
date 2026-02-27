import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Hotel, Star, MapPin, Camera, Trash2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { hotelsApi } from '../api';
import type { Hotel as HotelType } from '../types';

function AddHotelModal({ onClose, onCreated }: { onClose: () => void; onCreated: (h: HotelType) => void }) {
  const [form, setForm] = useState({ name: '', website: '', location: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const hotel = await hotelsApi.create({ name: form.name.trim(), website: form.website, location: form.location });
      onCreated(hotel);
      toast.success(`Hotel "${hotel.name}" criado com sucesso!`);
    } catch {
      toast.error('Erro ao criar hotel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-6">
        <h3 className="font-semibold text-slate-800 text-lg mb-5">Adicionar Hotel</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nome do Hotel *</label>
            <input
              className="input"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="ex: Hotel Beira Mar"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label">Website (opcional)</label>
            <input
              className="input"
              value={form.website}
              onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
              placeholder="https://www.hotel.pt"
              type="url"
            />
            <p className="text-xs text-slate-400 mt-1">
              Será usado para pesquisar informações automaticamente
            </p>
          </div>
          <div>
            <label className="label">Localização (opcional)</label>
            <input
              className="input"
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="ex: Lisboa, Portugal"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'A criar...' : 'Criar Hotel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Hotels() {
  const [hotels, setHotels] = useState<HotelType[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    hotelsApi.list()
      .then(setHotels)
      .catch(() => toast.error('Erro ao carregar hotéis'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = hotels.filter(h =>
    h.name.toLowerCase().includes(search.toLowerCase()) ||
    h.location?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Eliminar "${name}" e todos os seus dados?`)) return;
    try {
      await hotelsApi.delete(id);
      setHotels(prev => prev.filter(h => h.id !== id));
      toast.success('Hotel eliminado');
    } catch {
      toast.error('Erro ao eliminar hotel');
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Pesquisar hotéis..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary whitespace-nowrap">
          <Plus size={16} />
          Adicionar Hotel
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="card p-5 shimmer h-36" />)}
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="card p-12 text-center">
          <Hotel size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">
            {search ? 'Nenhum hotel encontrado' : 'Sem hotéis ainda'}
          </p>
          {!search && (
            <button onClick={() => setShowAdd(true)} className="btn-primary mt-4">
              <Plus size={16} />
              Adicionar primeiro hotel
            </button>
          )}
        </div>
      )}

      {/* Hotel grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map(hotel => (
            <div key={hotel.id} className="card hover:shadow-md transition-shadow group">
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center text-brand-700 font-bold text-lg flex-shrink-0">
                      {hotel.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-800 truncate">{hotel.name}</h3>
                      {hotel.location && (
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin size={11} />
                          {hotel.location}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(hotel.id, hotel.name)}
                    className="btn-ghost p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {hotel.stars && hotel.stars > 0 ? (
                  <div className="flex items-center gap-0.5 mt-3">
                    {Array.from({ length: hotel.stars }).map((_, i) => (
                      <Star key={i} size={12} className="text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                ) : null}

                {hotel.description && (
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2">{hotel.description}</p>
                )}

                <div className="flex items-center gap-3 mt-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Camera size={12} />
                    {hotel.photo_count || 0} fotos
                  </span>
                  <span className="badge-amber">{hotel.draft_count || 0} rascunhos</span>
                  <span className="badge-green">{hotel.approved_count || 0} aprovados</span>
                </div>
              </div>

              <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between">
                <Link
                  to={`/hotels/${hotel.id}`}
                  className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                >
                  Ver perfil →
                </Link>
                {hotel.website && (
                  <a
                    href={hotel.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add hotel modal */}
      {showAdd && (
        <AddHotelModal
          onClose={() => setShowAdd(false)}
          onCreated={hotel => {
            setHotels(prev => [hotel, ...prev]);
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}
