import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

const socket = io(import.meta.env.BACKEND_URL || "http://localhost:5000");

const VideoCard = ({ value, url }) => {
  const [downloadType, setDownloadType] = useState("video");
  const [selectedFormat, setSelectedFormat] = useState("");
  const [progress, setProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState("idle"); // idle | downloading | complete | error | cancelled
  const abortControllerRef = useRef(null);

  useEffect(() => {
    socket.on("download-progress", (data) => {
      setProgress(data.progress);
      setDownloadStatus(data.status || "downloading");
    });

    return () => {
      socket.off("download-progress");
    };
  }, []);

  // Auto-reset progress bar after completion/error/cancel
  useEffect(() => {
    if (
      downloadStatus === "complete" ||
      downloadStatus === "error" ||
      downloadStatus === "cancelled"
    ) {
      const delay = downloadStatus === "complete" ? 3000 : 3000;
      const timer = setTimeout(() => {
        setProgress(0);
        setDownloadStatus("idle");
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [downloadStatus]);

  const handleDownload = async () => {
    if (!selectedFormat) return;
    setDownloadStatus("downloading");
    setProgress(0);

    // Create AbortController to allow cancelling the fetch
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(
        `${import.meta.env.BACKEND_URL || "http://localhost:5000"}/api/videos/download`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url,
            formatId: selectedFormat,
            type: downloadType,
          }),
          signal: controller.signal,
        },
      );

      const blob = await response.blob();

      // Extract filename from Content-Disposition header, or use video title
      const contentDisposition = response.headers.get("content-disposition");
      let filename =
        downloadType === "audio" ? `${value.title}.mp3` : `${value.title}.mp4`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(
          /filename[^;=\n]*=["']?([^"';\n]*)["']?/,
        );
        if (filenameMatch && filenameMatch[1]) {
          filename = decodeURIComponent(filenameMatch[1]);
        }
      }

      const downloadUrl = window.URL.createObjectURL(blob);

      const a = document.createElement("a");

      a.href = downloadUrl;

      a.download = filename;

      document.body.appendChild(a);

      a.click();

      a.remove();

      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      // Don't set error if it was an intentional abort
      if (error.name === "AbortError") {
        console.log("Download fetch aborted");
      } else {
        console.log(error);
        setDownloadStatus("error");
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleCancel = async () => {
    try {
      // Abort the frontend fetch request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Tell the backend to kill yt-dlp and clean up
      await fetch(
        `${import.meta.env.BACKEND_URL || "http://localhost:5000"}/api/videos/cancel`,
        {
          method: "POST",
        },
      );
    } catch (error) {
      console.log("Cancel error:", error);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return "Unknown";

    const gb = bytes / (1024 * 1024 * 1024);

    return gb >= 1
      ? `${gb.toFixed(2)} GB`
      : `${Math.ceil(bytes / (1024 * 1024))} MB`;
  };

  const isDownloading = downloadStatus === "downloading";

  // Progress bar color based on status
  const getProgressBarColor = () => {
    switch (downloadStatus) {
      case "downloading":
        return "bg-blue-500";
      case "complete":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      case "cancelled":
        return "bg-orange-500";
      default:
        return "bg-blue-500";
    }
  };

  // Status label
  const getStatusLabel = () => {
    switch (downloadStatus) {
      case "downloading":
        return "Downloading...";
      case "complete":
        return "Download Complete!";
      case "error":
        return "Download Failed";
      case "cancelled":
        return "Download Cancelled";
      default:
        return "";
    }
  };

  // Status text color
  const getStatusColor = () => {
    switch (downloadStatus) {
      case "error":
        return "text-red-600";
      case "complete":
        return "text-green-600";
      case "cancelled":
        return "text-orange-600";
      default:
        return "text-blue-600";
    }
  };

  // Download button text
  const getButtonText = () => {
    if (isDownloading) return "Downloading...";
    if (downloadStatus === "complete") return "✓ Downloaded";
    return "Download";
  };

  return (
    <div>
      {/* Video Card */}
      <div className="bg-gray-50 border rounded-2xl p-5 shadow-md">
        <div className="flex flex-col md:flex-row gap-5">
          {/* Thumbnail */}
          <img
            src={value.thumbnail}
            alt="Thumbnail"
            className="w-full md:w-72 h-48 object-cover rounded-xl"
          />

          {/* Details */}
          <div className="flex-1">
            <h2 className="text-xl font-semibold mb-2">{value.title}</h2>

            <p className="text-gray-600 mb-5">
              Select download type and quality.
            </p>

            {/* Radio Buttons */}
            <div className="flex gap-6 mb-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="downloadType"
                  value="video"
                  checked={downloadType === "video"}
                  onChange={(e) => setDownloadType(e.target.value)}
                  className="w-4 h-4"
                  disabled={isDownloading}
                />
                <span className="font-medium">Video</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="downloadType"
                  value="audio"
                  checked={downloadType === "audio"}
                  onChange={(e) => setDownloadType(e.target.value)}
                  className="w-4 h-4"
                  disabled={isDownloading}
                />
                <span className="font-medium">Audio</span>
              </label>
            </div>

            {/* Show Video Quality Only */}
            {downloadType === "video" && (
              <div className="mb-4">
                <label className="block mb-1 font-medium">Video Quality</label>

                <select
                  className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  onChange={(e) => {
                    setSelectedFormat(e.target.value);
                  }}
                  disabled={isDownloading}
                >
                  <option value="">Select Quality</option>
                  {value.videoFormats.map((video) => (
                    <option key={video.formatId} value={video.formatId}>
                      {video.quality} - {formatSize(video.totalFilesize)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Show Audio Quality Only */}
            {downloadType === "audio" && (
              <div className="mb-6">
                <label className="block mb-1 font-medium">Audio Quality</label>

                <select
                  className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  onChange={(e) => {
                    setSelectedFormat(e.target.value);
                  }}
                  disabled={isDownloading}
                >
                  <option value="">Select Quality</option>
                  {value.audioFormats.map((audio) => (
                    <option key={audio.formatId} value={audio.formatId}>
                      {audio.quality} - {formatSize(audio.totalFilesize)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Download Progress Bar */}
            {downloadStatus !== "idle" && (
              <div className="mb-4">
                <div className="flex justify-between mb-1">
                  <span className={`text-sm font-medium ${getStatusColor()}`}>
                    {getStatusLabel()}
                  </span>

                  <span className={`text-sm font-semibold ${getStatusColor()}`}>
                    {downloadStatus === "error" ||
                    downloadStatus === "cancelled"
                      ? "✕"
                      : `${progress.toFixed(1)}%`}
                  </span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className={`${getProgressBarColor()} h-3 rounded-full transition-all duration-300 ease-out ${
                      isDownloading ? "animate-pulse" : ""
                    }`}
                    style={{
                      width:
                        downloadStatus === "error" ||
                        downloadStatus === "cancelled"
                          ? "100%"
                          : `${progress}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Download & Cancel Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                className={`flex-1 py-3 rounded-xl font-semibold transition-all duration-200 ${
                  isDownloading
                    ? "bg-gray-400 cursor-not-allowed text-white"
                    : downloadStatus === "complete"
                      ? "bg-green-500 text-white"
                      : !selectedFormat
                        ? "bg-gray-300 cursor-not-allowed text-gray-500"
                        : "bg-green-500 hover:bg-green-600 text-white"
                }`}
                onClick={handleDownload}
                disabled={isDownloading || !selectedFormat}
              >
                {getButtonText()}
              </button>

              {/* Cancel Button - only visible during download */}
              {isDownloading && (
                <button
                  type="button"
                  className="px-5 py-3 rounded-xl font-semibold bg-red-500 hover:bg-red-600 text-white transition-all duration-200"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCard;
