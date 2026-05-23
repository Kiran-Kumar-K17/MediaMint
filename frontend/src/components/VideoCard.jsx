import { useState } from "react";
import { API_URL } from "../api/api.js";

const VideoCard = ({ value, url }) => {
  const [downloadType, setDownloadType] = useState("video");
  const [selectedFormat, setSelectedFormat] = useState("");
  console.log(value);

  const handleDownload = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/videos/download",
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
        },
      );

      const blob = await response.blob();

      const downloadUrl = window.URL.createObjectURL(blob);

      const a = document.createElement("a");

      a.href = downloadUrl;

      a.download = downloadType === "audio" ? "audio.mp3" : "video.mkv";

      document.body.appendChild(a);

      a.click();

      a.remove();

      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.log(error);
    }
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
                >
                  <option value="">Select Quality</option>
                  {value.videoFormats.map((video) => (
                    <option key={video.formatId} value={video.formatId}>
                      {video.quality} -{" "}
                      {Math.ceil(video.filesize / (1024 * 1024))} MB
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
                >
                  <option value="">Select Quality</option>
                  {value.audioFormats.map((audio) => (
                    <option key={audio.formatId} value={audio.formatId}>
                      {audio.quality} -{" "}
                      {Math.ceil(audio.filesize / (1024 * 1024))} MB
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Download Button */}
            <button
              type="button"
              className="w-full bg-green-500 hover:bg-green-600 transition text-white py-3 rounded-xl font-semibold"
              onClick={handleDownload}
            >
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCard;
