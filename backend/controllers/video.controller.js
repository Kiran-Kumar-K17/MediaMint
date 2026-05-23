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
      .filter((f) => f.vcodec !== "none")
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
        error: "Missing fields",
      });
    }

    const info = await ytdlp(url, {
      dumpSingleJson: true,
    });

    const safeTitle = info.title.replace(/[<>:"/\\|?*]+/g, "");

    const tempPath = path.join(
      os.tmpdir(),
      `${Date.now()}-${safeTitle}.%(ext)s`,
    );

    const outputFile = path.join(
      os.tmpdir(),
      `${Date.now()}-${
        type === "audio" ? `${safeTitle}.mp3` : `${safeTitle}.mkv`
      }`,
    );

    const args =
      type === "audio"
        ? [
            "-f",
            formatId,

            "--downloader",
            "aria2c",

            "--downloader-args",
            "aria2c:-x 16 -s 16 -k 1M",

            "-x",
            "--audio-format",
            "mp3",

            "-o",
            outputFile,

            url,
          ]
        : [
            "-f",
            `${formatId}+bestaudio`,

            "--downloader",
            "aria2c",

            "--downloader-args",
            "aria2c:-x 16 -s 16 -k 1M",

            "--merge-output-format",
            "mkv",

            "--concurrent-fragments",
            "8",

            "-o",
            outputFile,

            url,
          ];

    const ytDlpProcess = spawn(ytDlpBin, args);

    ytDlpProcess.stderr.on("data", (data) => {
      console.log(data.toString());
    });

    ytDlpProcess.on("close", async (code) => {
      if (code !== 0) {
        return res.status(500).json({
          error: "Download failed",
        });
      }

      res.download(outputFile, (err) => {
        fs.unlinkSync(outputFile);

        if (err) {
          console.log(err);
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
