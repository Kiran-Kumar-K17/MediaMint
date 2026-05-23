import { useState } from "react";
import { API_URL } from "../api/api.js";
import VideoCard from "../components/VideoCard.jsx";

const HomePage = () => {
  const [url, setUrl] = useState("");
  const [data, setData] = useState("");

  const fetchData = async (e) => {
    try {
      e.preventDefault();
      const response = await API_URL.post("/videos/info", { url });
      setData(response.data);
      console.log(data);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen flex items-center justify-center px-4">
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
          >
            Search
          </button>
        </form>
        {data ? (
          <div>
            <VideoCard value={data} url={url} />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default HomePage;
