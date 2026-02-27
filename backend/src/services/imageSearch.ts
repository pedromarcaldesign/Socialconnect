import axios from 'axios';

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

// Search Unsplash for free stock images
async function searchUnsplash(query: string, perPage = 12): Promise<StockImage[]> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return [];

  try {
    const response = await axios.get('https://api.unsplash.com/search/photos', {
      params: {
        query,
        per_page: perPage,
        orientation: 'landscape',
        content_filter: 'high',
      },
      headers: {
        Authorization: `Client-ID ${accessKey}`,
      },
    });

    return response.data.results.map((photo: Record<string, unknown>) => {
      const urls = photo.urls as Record<string, string>;
      const user = photo.user as Record<string, unknown>;
      const links = photo.links as Record<string, string>;
      return {
        id: `unsplash_${photo.id}`,
        url: urls.regular,
        thumb: urls.thumb,
        full: urls.full,
        description: (photo.alt_description as string) || (photo.description as string) || 'Hotel photo',
        author: (user.name as string) || 'Unknown',
        author_url: `https://unsplash.com/@${user.username}`,
        source: 'unsplash' as const,
        download_url: links.download,
      };
    });
  } catch (error) {
    console.error('Unsplash search error:', error);
    return [];
  }
}

// Search Pexels for free stock images
async function searchPexels(query: string, perPage = 12): Promise<StockImage[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await axios.get('https://api.pexels.com/v1/search', {
      params: {
        query,
        per_page: perPage,
        orientation: 'landscape',
      },
      headers: {
        Authorization: apiKey,
      },
    });

    return response.data.photos.map((photo: Record<string, unknown>) => {
      const src = photo.src as Record<string, string>;
      const photographer_url = photo.photographer_url as string;
      return {
        id: `pexels_${photo.id}`,
        url: src.large,
        thumb: src.small,
        full: src.original,
        description: (photo.alt as string) || 'Hotel photo',
        author: photo.photographer as string,
        author_url: photographer_url,
        source: 'pexels' as const,
        download_url: src.original,
      };
    });
  } catch (error) {
    console.error('Pexels search error:', error);
    return [];
  }
}

export async function searchStockImages(query: string, perPage = 12): Promise<StockImage[]> {
  const [unsplashResults, pexelsResults] = await Promise.all([
    searchUnsplash(query, Math.ceil(perPage / 2)),
    searchPexels(query, Math.ceil(perPage / 2)),
  ]);

  const combined = [...unsplashResults, ...pexelsResults];

  if (combined.length === 0) {
    // Return placeholder if no API keys configured
    return [{
      id: 'placeholder_1',
      url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
      thumb: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200',
      full: 'https://images.unsplash.com/photo-1566073771259-6a8506099945',
      description: 'Hotel exterior',
      author: 'Unsplash',
      author_url: 'https://unsplash.com',
      source: 'unsplash',
      download_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945',
    }];
  }

  return combined;
}
