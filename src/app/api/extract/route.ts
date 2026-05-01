import { NextResponse } from 'next/server';
import { qualifyReel } from '../reel-qualification';

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Failed to extract video';

// Extract video ID from YouTube URL
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// Get video metadata from Invidious
async function getVideoInfo(videoId: string) {
  const instances = [
    'https://vid.puffyan.us',
    'https://invidious.snopyta.org',
    'https://invidious.kavin.rocks',
  ];

  for (const instance of instances) {
    try {
      const response = await fetch(
        `${instance}/api/v1/videos/${videoId}`,
        { signal: AbortSignal.timeout(15000) }
      );

      if (!response.ok) continue;

      return await response.json();
    } catch (e) {
      console.error(`Instance ${instance} failed:`, e);
      continue;
    }
  }

  return null;
}

// Get direct video URL from Invidious
async function getDirectVideoUrl(videoId: string, format: 'video' | 'audio' = 'video'): Promise<string | null> {
  const instances = [
    'https://vid.puffyan.us',
    'https://invidious.snopyta.org',
    'https://invidious.kavin.rocks',
  ];

  for (const instance of instances) {
    try {
      const response = await fetch(
        `${instance}/api/v1/videos/${videoId}?fields=formatStreams`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (!response.ok) continue;

      const data = await response.json();
      const streams = data.formatStreams || [];

      // Find the best quality stream
      const bestStream = streams
        .filter((s: any) => s.type?.includes('video'))
        .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];

      return bestStream?.url || null;
    } catch (e) {
      console.error(`Stream fetch failed:`, e);
      continue;
    }
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const videoId = extractVideoId(url);

    if (!videoId) {
      return NextResponse.json({
        success: false,
        error: 'Invalid YouTube URL. Please provide a valid YouTube video URL.',
      }, { status: 400 });
    }

    console.log(`Fetching info for video ${videoId}...`);

    // Get video info from Invidious
    const videoInfo = await getVideoInfo(videoId);

    if (!videoInfo) {
      return NextResponse.json({
        success: false,
        error: 'Could not fetch video information. The video may be private or unavailable.',
      }, { status: 404 });
    }

    // Qualify the reel
    const metadata = {
      width: videoInfo.width,
      height: videoInfo.height,
      duration: videoInfo.lengthSeconds,
    };

    const reel = qualifyReel(metadata);

    if (!reel.isReel) {
      return NextResponse.json({
        success: false,
        error: `Rejected: ${reel.reason}. V- only accepts 9:16 vertical videos.`,
        reel,
      }, { status: 422 });
    }

    // Get direct video URL for streaming
    const directUrl = await getDirectVideoUrl(videoId);

    if (!directUrl) {
      return NextResponse.json({
        success: false,
        error: 'Could not get video stream URL. Please try again.',
      }, { status: 500 });
    }

    // For now, we'll use the direct Invidious stream URL
    // This avoids the need for server-side downloading
    const localUrl = directUrl;

    return NextResponse.json({
      success: true,
      video: {
        id: videoId,
        title: videoInfo.title || 'Unknown Title',
        thumbnail: videoInfo.videoThumbnails?.[0]?.url || '',
        localUrl,
        originalUrl: url,
        platform: 'YouTube',
        width: reel.width,
        height: reel.height,
        duration: reel.duration,
        aspectRatio: reel.aspectRatio,
        formatLabel: reel.formatLabel,
      }
    });

  } catch (error: unknown) {
    console.error('Extraction error:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
