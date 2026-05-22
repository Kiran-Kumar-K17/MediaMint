import ytdlp from "yt-dlp-exec";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ytDlpBin = path.resolve(
  __dirname,
  "../node_modules/yt-dlp-exec/bin/yt-dlp",
);

export const getVideoInfo = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        error: "URL is required",
      });
    }

    const info = await ytdlp(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
    });

    const videoFormats = info.formats
      .filter((f) => f.vcodec !== "none" && f.height >= 144 && f.height <= 1440)
      .sort((a, b) => b.height - a.height) // highest quality first
      .filter(
        (f, index, arr) =>
          index === arr.findIndex((t) => t.height === f.height), // dedupe by height
      )
      .map((f) => ({
        quality: f.height + "p",
        formatId: f.format_id,
        ext: f.ext,
        filesize: f.filesize,
        url: f.url,
      }));

    const audioFormats = info.formats
      .filter((f) => f.acodec !== "none" && f.vcodec === "none")
      .sort((a, b) => (b.abr || 0) - (a.abr || 0)) // highest bitrate first
      .filter(
        (f, index, arr) =>
          index ===
          arr.findIndex((t) => Math.round(t.abr) === Math.round(f.abr)), // dedupe by bitrate
      )
      .map((f) => ({
        quality: f.abr ? `${Math.round(f.abr)}kbps` : "audio",
        formatId: f.format_id,
        ext: f.ext,
        filesize: f.filesize,
        url: f.url,
      }));

    res.json({
      title: info.title,
      thumbnail: info.thumbnail,
      uploader: info.uploader,
      videoFormats,
      audioFormats,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch video info",
    });
  }
};

export const downloadVideo = async (req, res) => {
  try {
    const { url, formatId, type } = req.body;

    if (!url || !formatId) {
      return res.status(400).json({
        message: "Missing fields",
      });
    }

    const info = await ytdlp(url, {
      dumpSingleJson: true,
    });

    console.log(`Fetched: ${info.title}`);

    const fileName =
      type === "audio" ? `${info.title}.mp3` : `${info.title}.mkv`;

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    res.setHeader(
      "Content-Type",
      type === "audio" ? "audio/mpeg" : "video/x-matroska",
    );

    const args =
      type === "audio"
        ? ["-x", "--audio-format", "mp3", "-o", "-", url]
        : [
            "-f",
            `${formatId}+bestaudio`,
            "--merge-output-format",
            "mkv",
            "-o",
            "-",
            url,
          ];

    const ytDlpProcess = spawn(ytDlpBin, args);

    ytDlpProcess.stdout.pipe(res);

    ytDlpProcess.stderr.on("data", (data) => {
      console.log(data.toString());
    });

    ytDlpProcess.on("close", (code) => {
      console.log(`yt-dlp exited with code ${code}`);
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to download",
    });
  }
};
