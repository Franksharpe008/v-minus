import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import { qualifyReel } from '../reel-qualification';

const execPromise = util.promisify(exec);
const MAX_CLIP_LIMIT = 6;
const SEARCH_POOL_SIZE = 50;
const MAX_INSPECTED_CANDIDATES = 20;
const COMMAND_MAX_BUFFER = 1024 * 1024 * 10;

interface SearchResult {
  reel?: {
    isReel: boolean;
  };
}

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Search failed';

export async function POST(req: NextRequest) {
  try {
    const { query, limit = 3, timeframe = 'any' } = await req.json();
    const safeLimit = Math.min(Math.max(Number(limit) || 3, 1), MAX_CLIP_LIMIT);

    if (!query) {
      return NextResponse.json({ success: false, error: 'Search query is required' }, { status: 400 });
    }

    // Since we are running in Next.js, we resolve the path to the local yt-dlp binary
    const ytdlpPath = path.join(process.cwd(), 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp');
    
    // Timeframe filter logic
    let dateFilter = '';
    if (timeframe === '24h') dateFilter = '--dateafter today-1day';
    if (timeframe === '7d') dateFilter = '--dateafter today-7days';
    if (timeframe === '30d') dateFilter = '--dateafter today-30days';

    // First pull a lightweight candidate pool, then inspect each candidate until enough true reels pass.
    const searchCommand = `${ytdlpPath} "ytsearch${SEARCH_POOL_SIZE}:${query}" ${dateFilter} --dump-json --flat-playlist`;

    const { stdout } = await execPromise(searchCommand, { maxBuffer: COMMAND_MAX_BUFFER });
    
    // The output is one JSON object per line
    const lines = stdout.trim().split('\n').filter(line => line.length > 0);
    const candidates = lines.map(line => {
      try {
        const data = JSON.parse(line);
        // Ensure we build a complete URL if it's missing
        const url = data.url || data.original_url || (data.id ? `https://www.youtube.com/watch?v=${data.id}` : null);
        if (!url) return null;
        
        return {
          id: data.id,
          title: data.title,
          url: url,
          duration: data.duration,
          view_count: data.view_count,
          uploader: data.uploader,
        };
      } catch {
        return null;
      }
    }).filter(Boolean);

    const inspectedResults: SearchResult[] = [];
    const reelResults = [];

    for (const candidate of candidates.slice(0, MAX_INSPECTED_CANDIDATES)) {
      if (!candidate || reelResults.length >= safeLimit) continue;

      try {
        const metaCommand = `${ytdlpPath} "${candidate.url}" --dump-single-json --no-warnings --skip-download --no-playlist --no-check-certificate`;
        const { stdout: metaOut } = await execPromise(metaCommand, { maxBuffer: COMMAND_MAX_BUFFER });
        const metadata = JSON.parse(metaOut);
        const reel = qualifyReel(metadata);
        const result = {
          ...candidate,
          duration: metadata.duration,
          width: metadata.width,
          height: metadata.height,
          reel,
        };

        inspectedResults.push(result);
        if (reel.isReel) {
          reelResults.push(result);
        }
      } catch (error) {
        console.error('Candidate reel inspection failed:', error);
      }
    }

    const results = reelResults.slice(0, safeLimit);

    return NextResponse.json({
      success: true,
      results,
      rejected: inspectedResults.length - reelResults.length,
    });

  } catch (error: unknown) {
    console.error('Search API Error:', error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
