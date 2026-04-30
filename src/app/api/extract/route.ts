import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { exec } from 'child_process';
import util from 'util';
import { qualifyReel } from '../reel-qualification';

const execPromise = util.promisify(exec);
const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Failed to extract video';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const videoId = crypto.randomUUID();
    const outputDir = path.join(process.cwd(), 'public', 'media');

    // Ensure the media directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`Starting extraction for ${url}...`);
    
    // Path to the yt-dlp binary
    const ytDlpPath = path.join(process.cwd(), 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp');

    // 1. Get metadata
    const metaCmd = `${ytDlpPath} "${url}" --dump-single-json --no-warnings --no-check-certificate`;
    const { stdout: metaOut } = await execPromise(metaCmd);
    const metadata = JSON.parse(metaOut);

    const title = metadata.title || 'Unknown Title';
    const thumbnail = metadata.thumbnail || '';
    const reel = qualifyReel(metadata);

    if (!reel.isReel) {
      return NextResponse.json({
        success: false,
        error: `Rejected: ${reel.reason}. The Viral Oracle only accepts 9:16 reels-ready clips.`,
        reel,
      }, { status: 422 });
    }
    
    const finalFilename = `${videoId}.mp4`;
    const finalPath = path.join(outputDir, finalFilename);

    console.log(`Downloading video to ${finalPath}...`);

    // 2. Download
    const downloadCmd = `${ytDlpPath} "${url}" -o "${finalPath}" -f "bestvideo[ext=mp4][height<=1920]+bestaudio[ext=m4a]/best[ext=mp4][height<=1920]/best" --merge-output-format mp4 --no-playlist`;
    await execPromise(downloadCmd);

    const localUrl = `/media/${finalFilename}`;

    return NextResponse.json({
      success: true,
      video: {
        id: videoId,
        title,
        thumbnail,
        localUrl,
        originalUrl: url,
        platform: metadata.extractor_key,
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
