import { useState } from "react";
import { API_URL } from "../api/api.js";
import VideoCard from "../components/VideoCard.jsx";

const HomePage = () => {
  const [url, setUrl] = useState("");
  const [data, setData] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchData = async (e) => {
    try {
      e.preventDefault();
      setLoading(true);
      const response = await API_URL.post("/videos/info", { url });
      setData(response.data);
      console.log(data);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-500 min-h-screen flex items-center justify-center px-4">
      <div className="bg-white shadow-xl rounded-2xl p-6 w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-center mb-6">
          YouTube Downloader
        </h1>

        {/* Search Form */}
        <form className="flex gap-3 mb-8">
          <input
            type="text"
            value={url}
            placeholder="Enter YouTube URL"
            className="flex-1 p-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => {
              setUrl(e.target.value);
            }}
          />

          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 transition text-white px-5 py-3 rounded-xl"
            onClick={fetchData}
            disabled={loading}
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {loading ? (
          <div className="mt-6">
            {loading && (
              <div className="bg-gray-50 border rounded-2xl p-5 shadow-md animate-pulse">
                <div className="flex flex-col md:flex-row gap-5">
                  {/* Thumbnail Skeleton */}
                  <div className="w-full md:w-72 h-48 bg-gray-300 rounded-xl"></div>

                  {/* Content Skeleton */}
                  <div className="flex-1">
                    <div className="h-6 bg-gray-300 rounded w-3/4 mb-4"></div>

                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>

                    <div className="flex gap-6 mb-6">
                      <div className="h-5 w-20 bg-gray-300 rounded"></div>
                      <div className="h-5 w-20 bg-gray-300 rounded"></div>
                    </div>

                    <div className="mb-6">
                      <div className="h-4 w-32 bg-gray-300 rounded mb-2"></div>

                      <div className="h-12 bg-gray-200 rounded-xl"></div>
                    </div>

                    <div className="h-12 bg-gray-300 rounded-xl"></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : data ? (
          <div>
            <VideoCard value={data} url={url} />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default HomePage;
