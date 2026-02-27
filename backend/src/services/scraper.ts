import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScrapedContent {
  title: string;
  description: string;
  content: string;
  images: string[];
  url: string;
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
};

async function fetchUrl(url: string): Promise<string> {
  const response = await axios.get(url, {
    headers: HEADERS,
    timeout: 10000,
    maxRedirects: 3,
  });
  return response.data;
}

function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html);

  // Remove unwanted elements
  $('script, style, nav, footer, header, aside, .cookie, .popup, .modal, .ad, .advertisement').remove();

  // Extract meaningful text
  const texts: string[] = [];

  // Meta description
  const metaDesc = $('meta[name="description"]').attr('content');
  if (metaDesc) texts.push(metaDesc);

  // OG description
  const ogDesc = $('meta[property="og:description"]').attr('content');
  if (ogDesc && ogDesc !== metaDesc) texts.push(ogDesc);

  // Main content areas
  const mainSelectors = ['main', 'article', '.content', '#content', '.about', '.description', 'section', '.hotel-info'];
  for (const selector of mainSelectors) {
    const el = $(selector);
    if (el.length > 0) {
      const text = el.text().replace(/\s+/g, ' ').trim();
      if (text.length > 100) texts.push(text.substring(0, 3000));
      break;
    }
  }

  // Paragraphs as fallback
  if (texts.length < 2) {
    $('p').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 50) texts.push(text);
    });
  }

  // Headings for amenities/features
  $('h1, h2, h3, h4, li').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 10 && text.length < 200) texts.push(text);
  });

  return texts.join('\n').substring(0, 10000);
}

// Try to find hotel website via a direct URL attempt
async function tryDirectUrl(hotelName: string): Promise<ScrapedContent | null> {
  // Common hotel website patterns
  const slug = hotelName.toLowerCase()
    .replace(/hotel/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

  const patterns = [
    `https://www.hotel${slug}.pt`,
    `https://www.hotel${slug}.com`,
    `https://${slug}.pt`,
    `https://${slug}.com`,
  ];

  for (const url of patterns) {
    try {
      const html = await fetchUrl(url);
      const $ = cheerio.load(html);
      const title = $('title').text().trim();

      if (title && title.toLowerCase().includes(slug.substring(0, 4).toLowerCase())) {
        const content = extractTextFromHtml(html);
        const images = $('img[src]').map((_, el) => $(el).attr('src') || '').get().slice(0, 5);

        return {
          title,
          description: $('meta[name="description"]').attr('content') || '',
          content,
          images,
          url,
        };
      }
    } catch {
      // Try next pattern
    }
  }

  return null;
}

// Scrape using Booking.com search
async function scrapeBooking(hotelName: string): Promise<ScrapedContent | null> {
  try {
    const searchUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(hotelName)}&lang=pt-pt`;
    const html = await fetchUrl(searchUrl);
    const $ = cheerio.load(html);

    // Find first hotel result
    const firstResult = $('[data-testid="property-card"]').first();
    if (firstResult.length === 0) return null;

    const hotelUrl = firstResult.find('a').first().attr('href');
    if (!hotelUrl) return null;

    const fullUrl = hotelUrl.startsWith('http') ? hotelUrl : `https://www.booking.com${hotelUrl}`;

    const hotelHtml = await fetchUrl(fullUrl);
    const hotelContent = extractTextFromHtml(hotelHtml);
    const hotel$ = cheerio.load(hotelHtml);

    return {
      title: hotel$('title').text().trim(),
      description: hotel$('meta[name="description"]').attr('content') || '',
      content: hotelContent,
      images: [],
      url: fullUrl,
    };
  } catch {
    return null;
  }
}

// Main scrape function - tries multiple sources
export async function scrapeHotelInfo(hotelName: string, websiteUrl?: string): Promise<ScrapedContent> {
  const results: string[] = [];

  // 1. If website URL provided, scrape it directly
  if (websiteUrl) {
    try {
      const html = await fetchUrl(websiteUrl);
      const content = extractTextFromHtml(html);
      const $ = cheerio.load(html);

      return {
        title: $('title').text().trim(),
        description: $('meta[name="description"]').attr('content') || '',
        content,
        images: [],
        url: websiteUrl,
      };
    } catch (error) {
      results.push(`Failed to scrape provided URL: ${error}`);
    }
  }

  // 2. Try direct URL patterns
  const direct = await tryDirectUrl(hotelName);
  if (direct) return direct;

  // 3. Try Booking.com
  const booking = await scrapeBooking(hotelName);
  if (booking) return booking;

  // 4. Return minimal info if all fails
  return {
    title: hotelName,
    description: '',
    content: `Hotel: ${hotelName}\nInformação obtida por nome do estabelecimento.`,
    images: [],
    url: '',
  };
}
