import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Hotels from './pages/Hotels';
import HotelDetail from './pages/HotelDetail';
import GeneratePosts from './pages/GeneratePosts';
import DraftPosts from './pages/DraftPosts';
import ApprovedPosts from './pages/ApprovedPosts';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="hotels" element={<Hotels />} />
        <Route path="hotels/:id" element={<HotelDetail />} />
        <Route path="generate" element={<GeneratePosts />} />
        <Route path="drafts" element={<DraftPosts />} />
        <Route path="approved" element={<ApprovedPosts />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
