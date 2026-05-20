import ytdlp from "yt-dlp-exec";

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

    const formats = info.formats
      .filter((f) => f.ext === "mp4" && f.vcodec !== "none")
      .map((f) => ({
        quality: f.format_note || f.height + "p",
        ext: f.ext,
        filesize: f.filesize,
        url: f.url,
      }));

    res.json({
      title: info.title,
      thumbnail: info.thumbnail,
      duration: info.duration,
      uploader: info.uploader,
      formats,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch video info",
    });
  }
};
