export interface Hotel {
  id: string;
  name: string;
  website?: string;
  description?: string;
  location?: string;
  stars?: number;
  amenities: string[];
  tone: string;
  instagram_handle?: string;
  facebook_page?: string;
  target_audience?: string;
  keywords: string[];
  scraped_data: Record<string, unknown>;
  photo_count?: number;
  draft_count?: number;
  approved_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Photo {
  id: string;
  hotel_id: string;
  filename: string;
  original_name: string;
  path: string;
  size?: number;
  url: string;
  analysis: PhotoAnalysis;
  tags: string[];
  description?: string;
  created_at: string;
}

export interface PhotoAnalysis {
  description?: string;
  tags?: string[];
  mood?: string;
  subjects?: string[];
  setting?: string;
  post_suggestions?: string[];
}

export interface Post {
  id: string;
  hotel_id: string;
  hotel_name?: string;
  hotel_location?: string;
  photo_id?: string;
  photo_url?: string;
  stock_image_url?: string;
  stock_image_credit?: string;
  platform: 'facebook' | 'instagram' | 'both';
  text_pt: string;
  text_en?: string;
  hashtags: string[];
  status: 'draft' | 'approved';
  generation_mode: 'batch' | 'manual' | 'idea';
  idea?: string;
  is_bilingual: boolean;
  platform_tip?: string;
  created_at: string;
  updated_at: string;
}

export interface StockImage {
  id: string;
  url: string;
  thumb: string;
  full: string;
  description: string;
  author: string;
  author_url: string;
  source: 'unsplash' | 'pexels';
  download_url: string;
}
