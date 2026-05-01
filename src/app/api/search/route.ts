import { NextRequest, NextResponse } from 'next/server';
import { qualifyReel } from '../reel-qualification';

const MAX_CLIP_LIMIT = 6;

interface YouTubeVideo {
  id: {
    videoId: string;
  };
  snippet: {
    title: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
  };
}

interface YouTubeSearchResponse {
  items?: YouTubeVideo[];
}

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Search failed';

async function searchYouTube(query: string, maxResults: number): Promise<YouTubeVideo[]> {
  // Use YouTube's built-in search via yt-dlp-compatible approach
  // We'll use the Invidious API (open-source YouTube frontend)
  const instances = [
    'https://vid.puffyan.us',
    'https://invidious.snopyta.org',
    'https://invidious.kavin.rocks',
  ];

  for (const instance of instances) {
    try {
      const response = await fetch(
        `${instance}/api/v1/search?q=${encodeURIComponent(query + ' shorts')}&type=video&limit=${maxResults}`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (!response.ok) continue;

      const data = await response.json();

      // Transform Invidious response to match YouTube format
      return data.map((item: any) => ({
        id: { videoId: item.videoId },
        snippet: {
          title: item.title,
          channelId: item.authorId,
          channelTitle: item.author,
          publishedAt: item.published || new Date().toISOString(),
        },
      }));
    } catch (e) {
      console.error(`Instance ${instance} failed:`, e);
      continue;
    }
  }

  return [];
}

async function getVideoMetadata(videoId: string) {
  const instances = [
    'https://vid.puffyan.us',
    'https://invidious.snopyta.org',
    'https://invidious.kavin.rocks',
  ];

  for (const instance of instances) {
    try {
      const response = await fetch(
        `${instance}/api/v1/videos/${videoId}`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (!response.ok) continue;

      const data = await response.json();

      return {
        id: videoId,
        title: data.title || '',
        width: data.width || undefined,
        height: data.height || undefined,
        duration: data.lengthSeconds || undefined,
        view_count: data.viewCount || undefined,
        uploader: data.author || '',
      };
    } catch (e) {
      console.error(`Metadata fetch failed for ${videoId}:`, e);
      continue;
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { query, limit = 3, timeframe = 'any' } = await req.json();
    const safeLimit = Math.min(Math.max(Number(limit) || 3, 1), MAX_CLIP_LIMIT);

    if (!query) {
      return NextResponse.json({ success: false, error: 'Search query is required' }, { status: 400 });
    }

    // Search using Invidious API (free, no API key needed)
    const searchResults = await searchYouTube(query, 20);

    if (!searchResults || searchResults.length === 0) {
      return NextResponse.json({ success: false, error: 'No results found. Try a different search term.' }, { status: 404 });
    }

    // Get metadata for each video and check qualification
    const qualifiedResults = [];

    for (const video of searchResults) {
      if (qualifiedResults.length >= safeLimit) break;

      try {
        const metadata = await getVideoMetadata(video.id.videoId);

        if (!metadata) continue;

        const reel = qualifyReel(metadata);

        if (reel.isReel) {
          qualifiedResults.push({
            url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
            ...metadata,
          });
        }
      } catch (error) {
        console.error('Failed to process video:', video.id.videoId, error);
      }
    }

    if (qualifiedResults.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No 9:16 vertical videos found. Try adding "shorts" to your search or try a different term.',
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      results: qualifiedResults,
    });

  } catch (error: unknown) {
    console.error('Search API Error:', error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
