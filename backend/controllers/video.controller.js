import ytdlp from "yt-dlp-exec";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import os from "os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ytDlpBin = path.resolve(
  __dirname,
  "../node_modules/yt-dlp-exec/bin/yt-dlp",
);

// Use a temp directory on the real disk instead of os.tmpdir() (which is a
// size-limited tmpfs). Large video merges need 2x the file size (source + output).
const TEMP_DIR = path.resolve(__dirname, "../.temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// Track the active download so it can be cancelled
let activeDownload = null;

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

    const bestAudio = info.formats
      .filter((f) => f.acodec !== "none" && f.vcodec === "none")
      .sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];

    const videoFormats = info.formats
      .filter((f) => f.vcodec !== "none" && f.height <= 2160)
      .sort((a, b) => b.height - a.height)
      .filter(
        (f, index, arr) =>
          index === arr.findIndex((t) => t.height === f.height),
      )
      .map((f) => ({
        quality: f.height + "p",
        formatId: f.format_id,
        ext: f.ext,

        filesize: f.filesize,
        filesizeApprox: f.filesize_approx,

        totalFilesize:
          (f.filesize || f.filesize_approx || 0) +
          (bestAudio?.filesize || bestAudio?.filesize_approx || 0),

        url: f.url,
      }));
    const audioFormats = info.formats
      .filter((f) => f.acodec !== "none" && f.vcodec === "none")
      .sort((a, b) => (b.abr || 0) - (a.abr || 0))
      .filter(
        (f, index, arr) =>
          index ===
          arr.findIndex((t) => Math.round(t.abr) === Math.round(f.abr)),
      )
      .map((f) => ({
        quality: f.abr ? `${Math.round(f.abr)}kbps` : "audio",

        formatId: f.format_id,
        ext: f.ext,

        filesize: f.filesize,
        filesizeApprox: f.filesize_approx,

        totalFilesize: f.filesize || f.filesize_approx || 0,

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
    const io = req.app.get("io");
    if (!url || !formatId) {
      return res.status(400).json({
        error: "Missing fields",
      });
    }

    const info = await ytdlp(url, {
      dumpSingleJson: true,
    });

    // Clean title for the final download filename sent to the user
    const safeTitle = info.title.replace(/[<>:"/\\|?*()\[\]{}]+/g, "").trim();

    // Use a simple numeric temp path to avoid ffmpeg issues with special chars
    // %(ext)s lets yt-dlp choose the correct extension based on codecs
    const tempId = Date.now();
    const outputTemplate = path.join(
      TEMP_DIR,
      type === "audio" ? `ytdl-${tempId}.mp3` : `ytdl-${tempId}.%(ext)s`,
    );

    // Emit 0% to signal download has started
    io.emit("download-progress", { progress: 0, status: "downloading" });

    // For video type: yt-dlp downloads video + audio separately then merges
    // Each stream reports 0-100%, so we track phases:
    //   Phase 0 (video): maps to 0-50% overall
    //   Phase 1 (audio): maps to 50-95% overall
    //   Merge: 95-100%
    // For audio type: single phase 0-100%
    const totalPhases = type === "audio" ? 1 : 2;
    let currentPhase = 0;
    let lastRawProgress = 0;

    // Don't force --merge-output-format: let yt-dlp pick the best container
    // for the codecs (VP9→webm, H.264→mp4, mixed→mkv). This avoids
    // "Conversion failed" errors from incompatible codec/container combos.
    const args =
      type === "audio"
        ? [
            "-f",
            formatId,
            "--newline",

            "-x",
            "--audio-format",
            "mp3",

            "-o",
            outputTemplate,

            url,
          ]
        : [
            "-f",
            `${formatId}+bestaudio`,
            "--newline",

            "-o",
            outputTemplate,

            url,
          ];

    const ytDlpProcess = spawn(ytDlpBin, args);

    // Track active download for cancellation
    activeDownload = { process: ytDlpProcess, tempId, cancelled: false };

    // Parse yt-dlp's native progress output (e.g. "[download]  45.2% of 10.00MiB ...")
    const parseProgress = (data) => {
      const text = data.toString();
      console.log(text);

      // Detect phase change: when yt-dlp starts downloading the next stream
      if (
        text.includes("[download] Destination:") ||
        text.includes("[download] Downloading")
      ) {
        // If we already saw progress for a previous phase, move to next
        if (lastRawProgress > 5) {
          currentPhase = Math.min(currentPhase + 1, totalPhases - 1);
          lastRawProgress = 0;
        }
      }

      // Detect merge phase
      if (text.includes("[Merger]") || text.includes("[ExtractAudio]")) {
        io.emit("download-progress", {
          progress: 97,
          status: "downloading",
        });
        return;
      }

      const match = text.match(/(\d+(\.\d+)?)%/);
      if (match) {
        const rawProgress = parseFloat(match[1]);
        lastRawProgress = rawProgress;

        // Calculate overall progress based on current phase
        let overallProgress;
        if (totalPhases === 1) {
          // Audio only: direct mapping
          overallProgress = Math.min(rawProgress, 99);
        } else {
          // Video + Audio: phase-based mapping
          const phaseWeight = currentPhase === 0 ? 50 : 45; // video=50%, audio=45%, merge=5%
          const phaseStart = currentPhase === 0 ? 0 : 50;
          overallProgress = phaseStart + (rawProgress / 100) * phaseWeight;
          overallProgress = Math.min(overallProgress, 99);
        }

        io.emit("download-progress", {
          progress: Math.round(overallProgress * 10) / 10,
          status: "downloading",
        });
      }
    };

    // yt-dlp outputs progress to stdout with --newline
    ytDlpProcess.stdout.on("data", parseProgress);
    ytDlpProcess.stderr.on("data", parseProgress);

    ytDlpProcess.on("close", async (code) => {
      const wasCancelled = activeDownload?.cancelled;
      activeDownload = null;

      // If cancelled by user, don't send any response (already handled)
      if (wasCancelled) {
        cleanupTempFiles(tempId);
        return;
      }

      if (code !== 0) {
        // Clean up any temp/partial files on failure
        cleanupTempFiles(tempId);
        io.emit("download-progress", { progress: 0, status: "error" });
        return res.status(500).json({
          error: "Download failed",
        });
      }

      // Find the actual output file (yt-dlp resolves %(ext)s to the real extension)
      const tempFiles = fs.readdirSync(TEMP_DIR);
      const matchedFiles = tempFiles
        .filter((f) => f.startsWith(`ytdl-${tempId}.`) && !f.includes(".part"))
        .map((f) => path.join(TEMP_DIR, f))
        .filter((f) => fs.existsSync(f) && fs.statSync(f).size > 0)
        // Pick the largest file (the final merged output, not fragments)
        .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);

      console.log("Matched files:", matchedFiles);

      const outputFile = matchedFiles[0];

      if (!outputFile) {
        io.emit("download-progress", { progress: 0, status: "error" });
        return res.status(500).json({ error: "Output file not found" });
      }

      // Get the actual extension yt-dlp chose
      const actualExt = path.extname(outputFile).slice(1); // e.g. "webm", "mkv", "mp4"
      const downloadFilename = `${safeTitle}.${actualExt}`;

      console.log("Sending file:", outputFile, "as:", downloadFilename);

      // Signal completion
      io.emit("download-progress", { progress: 100, status: "complete" });

      // Use sendFile with explicit Content-Disposition for reliability
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(downloadFilename)}"`,
      );
      res.setHeader("Content-Type", "application/octet-stream");

      res.sendFile(outputFile, { dotfiles: "allow" }, (err) => {
        // Always clean up after sending (or on send error)
        cleanupTempFiles(tempId);

        if (err) {
          console.log("Send file error:", err);
        }
      });
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Failed",
    });
  }
};

export const cancelDownload = async (req, res) => {
  try {
    if (!activeDownload) {
      return res.status(400).json({ error: "No active download" });
    }

    const { process: ytProcess, tempId } = activeDownload;
    activeDownload.cancelled = true;

    // Kill the yt-dlp process
    ytProcess.kill("SIGTERM");

    // Clean up temp files
    cleanupTempFiles(tempId);

    // Notify frontend
    const io = req.app.get("io");
    io.emit("download-progress", { progress: 0, status: "cancelled" });

    res.json({ message: "Download cancelled" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to cancel" });
  }
};

// Helper to clean up temp files and any related partial/fragment files
function cleanupTempFiles(tempId) {
  try {
    const files = fs.readdirSync(TEMP_DIR);
    const prefix = `ytdl-${tempId}.`;

    for (const file of files) {
      if (file.startsWith(prefix)) {
        try {
          fs.unlinkSync(path.join(TEMP_DIR, file));
        } catch (e) {
          // ignore individual file cleanup errors
        }
      }
    }
  } catch (e) {
    console.log("Cleanup error:", e.message);
  }
}
