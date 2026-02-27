import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Hotel, FileEdit, CheckCircle, Sparkles, ArrowRight, AlertCircle } from 'lucide-react';
import { hotelsApi, postsApi, healthApi } from '../api';
import type { Hotel as HotelType, Post } from '../types';

export default function Dashboard() {
  const [hotels, setHotels] = useState<HotelType[]>([]);
  const [drafts, setDrafts] = useState<Post[]>([]);
  const [approved, setApproved] = useState<Post[]>([]);
  const [health, setHealth] = useState<{ anthropic: boolean; unsplash: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      hotelsApi.list(),
      postsApi.list({ status: 'draft' }),
      postsApi.list({ status: 'approved' }),
      healthApi.check(),
    ]).then(([h, d, a, hlt]) => {
      setHotels(h);
      setDrafts(d);
      setApproved(a);
      setHealth(hlt);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const stats = [
    { label: 'Hotéis', value: hotels.length, icon: Hotel, color: 'blue', to: '/hotels' },
    { label: 'Em Rascunho', value: drafts.length, icon: FileEdit, color: 'amber', to: '/drafts' },
    { label: 'Aprovadas', value: approved.length, icon: CheckCircle, color: 'green', to: '/approved' },
    { label: 'Total Posts', value: drafts.length + approved.length, icon: Sparkles, color: 'purple', to: '/drafts' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card p-5 shimmer h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* API status warning */}
      {health && !health.anthropic && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Modo de demonstração ativo</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Configure o ficheiro <code className="bg-amber-100 px-1 rounded">.env</code> com a sua{' '}
              <strong>ANTHROPIC_API_KEY</strong> para usar IA real. Respostas geradas serão de demonstração.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, to }) => (
          <Link
            key={label}
            to={to}
            className="card p-5 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                color === 'blue' ? 'bg-blue-100' :
                color === 'amber' ? 'bg-amber-100' :
                color === 'green' ? 'bg-emerald-100' : 'bg-purple-100'
              }`}>
                <Icon size={18} className={
                  color === 'blue' ? 'text-blue-600' :
                  color === 'amber' ? 'text-amber-600' :
                  color === 'green' ? 'text-emerald-600' : 'text-purple-600'
                } />
              </div>
              <ArrowRight size={14} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-800 mb-4">Ações Rápidas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link to="/hotels" className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-brand-300 hover:bg-brand-50 transition-colors group">
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
              <Hotel size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">Adicionar Hotel</p>
              <p className="text-xs text-slate-500">Gerir perfis de hotéis</p>
            </div>
          </Link>
          <Link to="/generate" className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-brand-300 hover:bg-brand-50 transition-colors group">
            <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
              <Sparkles size={18} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">Gerar Posts</p>
              <p className="text-xs text-slate-500">3 modos de geração</p>
            </div>
          </Link>
          <Link to="/approved" className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-brand-300 hover:bg-brand-50 transition-colors group">
            <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CheckCircle size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">Posts Aprovados</p>
              <p className="text-xs text-slate-500">Ver e exportar posts</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent hotels */}
      {hotels.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Hotéis Recentes</h3>
            <Link to="/hotels" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
              Ver todos →
            </Link>
          </div>
          <div className="space-y-2">
            {hotels.slice(0, 5).map(hotel => (
              <Link
                key={hotel.id}
                to={`/hotels/${hotel.id}`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group"
              >
                <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center text-brand-600 font-bold text-sm flex-shrink-0">
                  {hotel.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{hotel.name}</p>
                  <p className="text-xs text-slate-400 truncate">{hotel.location || 'Sem localização'}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>{hotel.photo_count || 0} fotos</span>
                  <span className="badge-slate">{(hotel.draft_count || 0) + (hotel.approved_count || 0)} posts</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {hotels.length === 0 && (
        <div className="card p-10 text-center">
          <div className="text-5xl mb-4">🏨</div>
          <h3 className="font-semibold text-slate-800 mb-2">Comece por adicionar um hotel</h3>
          <p className="text-sm text-slate-500 mb-6">
            Adicione o primeiro hotel para começar a gerir as suas publicações nas redes sociais.
          </p>
          <Link to="/hotels" className="btn-primary">
            <Hotel size={16} />
            Adicionar Hotel
          </Link>
        </div>
      )}
    </div>
  );
}
